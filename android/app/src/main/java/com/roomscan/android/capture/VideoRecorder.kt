package com.roomscan.android.capture

import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import android.opengl.EGL14
import android.opengl.EGLConfig
import android.opengl.EGLContext
import android.opengl.EGLDisplay
import android.opengl.EGLExt
import android.opengl.EGLSurface
import android.opengl.GLES20
import android.os.Handler
import android.os.HandlerThread
import android.view.Surface
import java.io.File
import java.util.concurrent.CountDownLatch
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference

/**
 * Silent H.264 MP4 recorder fed from the AR GL thread.
 *
 * The camera texture is redrawn into the encoder's input surface with an
 * explicit presentation time (the shared media time), so the MP4 timeline is
 * exactly the timeline bookmarks use. Encoded output is drained and muxed on
 * a background thread. At most [MAX_IN_FLIGHT] frames may wait in the encoder;
 * beyond that frames are dropped and counted, which bounds memory.
 *
 * GL-thread methods: [encode], [releaseGl]. Any thread: [start], [finish].
 */
class VideoRecorder(
    private val file: File,
    val width: Int,
    val height: Int,
    private val bitRate: Int = 6_000_000,
    private val frameRate: Int = 30,
) {
    sealed class Result {
        data class Finished(val durationSeconds: Double, val framesWritten: Int, val framesDropped: Int) : Result()
        data class Failed(val message: String, val partial: Finished?) : Result()
    }

    private val thread = HandlerThread("video-encoder").apply { start() }
    private val handler = Handler(thread.looper)
    private lateinit var codec: MediaCodec
    private lateinit var inputSurface: Surface
    private var muxer: MediaMuxer? = null
    private var track = -1
    @Volatile private var muxing = false
    private val failure = AtomicReference<String?>(null)
    private val inFlight = AtomicInteger(0)
    private val eos = CountDownLatch(1)
    @Volatile private var lastPtsUs = -1L
    @Volatile private var firstPtsUs = -1L
    var framesWritten = 0; private set
    var framesDropped = 0; private set

    private var eglDisplay: EGLDisplay = EGL14.EGL_NO_DISPLAY
    private var eglContext: EGLContext = EGL14.EGL_NO_CONTEXT
    private var eglSurface: EGLSurface = EGL14.EGL_NO_SURFACE

    val failed: String? get() = failure.get()

    fun start() {
        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, width, height).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatSurface)
            setInteger(MediaFormat.KEY_BIT_RATE, bitRate)
            setInteger(MediaFormat.KEY_FRAME_RATE, frameRate)
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }
        codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        codec.setCallback(object : MediaCodec.Callback() {
            override fun onInputBufferAvailable(c: MediaCodec, index: Int) = Unit

            override fun onOutputFormatChanged(c: MediaCodec, format: MediaFormat) {
                try {
                    val m = MediaMuxer(file.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
                    track = m.addTrack(format)
                    m.start()
                    muxer = m
                    muxing = true
                } catch (e: Exception) {
                    fail("Could not create the MP4: ${e.message}")
                }
            }

            override fun onOutputBufferAvailable(c: MediaCodec, index: Int, info: MediaCodec.BufferInfo) {
                try {
                    val isConfig = info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG != 0
                    if (!isConfig && info.size > 0 && muxing && failure.get() == null) {
                        val buf = c.getOutputBuffer(index)!!
                        buf.position(info.offset); buf.limit(info.offset + info.size)
                        muxer!!.writeSampleData(track, buf, info)
                        if (firstPtsUs < 0) firstPtsUs = info.presentationTimeUs
                        lastPtsUs = info.presentationTimeUs
                    }
                    if (!isConfig && info.size > 0) inFlight.decrementAndGet()
                    c.releaseOutputBuffer(index, false)
                } catch (e: Exception) {
                    // Typically a full disk. Stop writing; what is already muxed stays playable.
                    fail("Writing the MP4 failed: ${e.message}")
                    runCatching { c.releaseOutputBuffer(index, false) }
                }
                if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) eos.countDown()
            }

            override fun onError(c: MediaCodec, e: MediaCodec.CodecException) {
                fail("Video encoder error: ${e.diagnosticInfo}")
                eos.countDown()
            }
        }, handler)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        inputSurface = codec.createInputSurface()
        codec.start()
    }

    /**
     * Draws one frame into the encoder (GL thread). [draw] renders into the
     * currently bound viewport. Returns false if the frame was dropped.
     */
    fun encode(mediaTimeSeconds: Double, draw: () -> Unit): Boolean {
        if (failure.get() != null) return false
        if (inFlight.get() >= MAX_IN_FLIGHT) { framesDropped++; return false }
        if (!ensureEglSurface()) return false
        val display = eglDisplay
        val savedDraw = EGL14.eglGetCurrentSurface(EGL14.EGL_DRAW)
        val savedRead = EGL14.eglGetCurrentSurface(EGL14.EGL_READ)
        if (!EGL14.eglMakeCurrent(display, eglSurface, eglSurface, eglContext)) { fail("eglMakeCurrent failed"); return false }
        try {
            GLES20.glViewport(0, 0, width, height)
            draw()
            EGLExt.eglPresentationTimeANDROID(display, eglSurface, (mediaTimeSeconds * 1_000_000_000L).toLong())
            inFlight.incrementAndGet()
            if (!EGL14.eglSwapBuffers(display, eglSurface)) { inFlight.decrementAndGet(); framesDropped++; return false }
            framesWritten++
            return true
        } finally {
            EGL14.eglMakeCurrent(display, savedDraw, savedRead, eglContext)
        }
    }

    /** Creates the EGL window surface on the GL thread, in the current context. */
    private fun ensureEglSurface(): Boolean {
        val ctx = EGL14.eglGetCurrentContext()
        if (eglSurface != EGL14.EGL_NO_SURFACE && ctx == eglContext) return true
        if (eglSurface != EGL14.EGL_NO_SURFACE) releaseGl()
        eglDisplay = EGL14.eglGetCurrentDisplay()
        eglContext = ctx
        val configId = IntArray(1)
        EGL14.eglQueryContext(eglDisplay, eglContext, EGL14.EGL_CONFIG_ID, configId, 0)
        val configs = arrayOfNulls<EGLConfig>(1)
        val count = IntArray(1)
        EGL14.eglChooseConfig(eglDisplay, intArrayOf(EGL14.EGL_CONFIG_ID, configId[0], EGL14.EGL_NONE), 0, configs, 0, 1, count, 0)
        if (count[0] < 1) { fail("No EGL config for video"); return false }
        eglSurface = EGL14.eglCreateWindowSurface(eglDisplay, configs[0], inputSurface, intArrayOf(EGL14.EGL_NONE), 0)
        if (eglSurface == EGL14.EGL_NO_SURFACE) { fail("This device's GL setup cannot feed the video encoder (EGL error ${EGL14.eglGetError()})"); return false }
        return true
    }

    /** GL thread: destroys the encoder's EGL surface. */
    fun releaseGl() {
        if (eglSurface != EGL14.EGL_NO_SURFACE) {
            EGL14.eglDestroySurface(eglDisplay, eglSurface)
            eglSurface = EGL14.EGL_NO_SURFACE
        }
    }

    /** Ends the stream and closes the file. Blocks up to a few seconds; call off the main thread. */
    fun finish(): Result {
        runCatching { codec.signalEndOfInputStream() }
        eos.await(5, TimeUnit.SECONDS)
        runCatching { codec.stop() }
        runCatching { codec.release() }
        runCatching { inputSurface.release() }
        var closeError: String? = null
        if (muxing) {
            try { muxer?.stop() } catch (e: Exception) { closeError = "Closing the MP4 failed: ${e.message}" }
        }
        runCatching { muxer?.release() }
        thread.quitSafely()
        val duration = if (firstPtsUs >= 0 && lastPtsUs >= firstPtsUs) (lastPtsUs - firstPtsUs) / 1e6 + 1.0 / frameRate else 0.0
        val done = Result.Finished(duration, framesWritten, framesDropped)
        val problem = failure.get() ?: closeError ?: if (!muxing) "No video frames were recorded." else null
        return if (problem != null) Result.Failed(problem, if (muxing && closeError == null) done else null) else done
    }

    private fun fail(message: String) { failure.compareAndSet(null, message) }

    companion object {
        const val MAX_IN_FLIGHT = 8

        /** Even sizes ≤ 1280 on the long side, preserving the camera image aspect. */
        fun outputSize(textureWidth: Int, textureHeight: Int, rotated: Boolean): Pair<Int, Int> {
            var w = if (rotated) textureHeight else textureWidth
            var h = if (rotated) textureWidth else textureHeight
            val scale = minOf(1.0, 1280.0 / maxOf(w, h))
            w = ((w * scale).toInt() / 16) * 16
            h = ((h * scale).toInt() / 16) * 16
            return w.coerceAtLeast(16) to h.coerceAtLeast(16)
        }
    }
}
