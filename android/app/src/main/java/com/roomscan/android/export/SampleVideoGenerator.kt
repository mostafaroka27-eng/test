package com.roomscan.android.export

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Typeface
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaFormat
import android.media.MediaMuxer
import com.roomscan.core.SampleProjectFactory
import com.roomscan.core.TimeFormat
import java.io.File
import java.io.IOException

/**
 * Renders the sample project's synthetic walkthrough (60 s, 640×480, 10 fps).
 * Each frame shows its own media time in large digits, so seeking from a plan
 * item can be checked by eye. Frames are fed as YUV buffers with explicit
 * presentation times, so frame N is exactly at N / 10 s.
 */
object SampleVideoGenerator {
    fun render(out: File) {
        val w = SampleProjectFactory.VIDEO_WIDTH
        val h = SampleProjectFactory.VIDEO_HEIGHT
        val fps = SampleProjectFactory.VIDEO_FRAME_RATE
        val frames = (SampleProjectFactory.VIDEO_DURATION * fps).toInt()

        val format = MediaFormat.createVideoFormat(MediaFormat.MIMETYPE_VIDEO_AVC, w, h).apply {
            setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
            setInteger(MediaFormat.KEY_BIT_RATE, 1_500_000)
            setInteger(MediaFormat.KEY_FRAME_RATE, fps.toInt())
            setInteger(MediaFormat.KEY_I_FRAME_INTERVAL, 1)
        }
        val codec = MediaCodec.createEncoderByType(MediaFormat.MIMETYPE_VIDEO_AVC)
        codec.configure(format, null, null, MediaCodec.CONFIGURE_FLAG_ENCODE)
        codec.start()
        val muxer = MediaMuxer(out.path, MediaMuxer.OutputFormat.MUXER_OUTPUT_MPEG_4)
        var track = -1
        var muxing = false
        val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
        val canvas = Canvas(bitmap)
        val pixels = IntArray(w * h)
        val info = MediaCodec.BufferInfo()
        var nextFrame = 0
        var inputDone = false
        var outputDone = false
        try {
            while (!outputDone) {
                if (!inputDone) {
                    val inIndex = codec.dequeueInputBuffer(10_000)
                    if (inIndex >= 0) {
                        if (nextFrame >= frames) {
                            codec.queueInputBuffer(inIndex, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
                            inputDone = true
                        } else {
                            val t = nextFrame / fps
                            drawFrame(canvas, w, h, t, nextFrame)
                            bitmap.getPixels(pixels, 0, w, 0, 0, w, h)
                            val image = codec.getInputImage(inIndex) ?: throw IOException("Encoder has no input image")
                            writeYuv(image, pixels, w, h)
                            val size = codec.getInputBuffer(inIndex)!!.capacity()
                            codec.queueInputBuffer(inIndex, 0, size, (t * 1_000_000).toLong(), 0)
                            nextFrame++
                        }
                    }
                }
                when (val outIndex = codec.dequeueOutputBuffer(info, 10_000)) {
                    MediaCodec.INFO_OUTPUT_FORMAT_CHANGED -> {
                        track = muxer.addTrack(codec.outputFormat); muxer.start(); muxing = true
                    }
                    MediaCodec.INFO_TRY_AGAIN_LATER -> Unit
                    else -> if (outIndex >= 0) {
                        val buf = codec.getOutputBuffer(outIndex)!!
                        if (info.flags and MediaCodec.BUFFER_FLAG_CODEC_CONFIG == 0 && info.size > 0 && muxing) {
                            buf.position(info.offset); buf.limit(info.offset + info.size)
                            muxer.writeSampleData(track, buf, info)
                        }
                        codec.releaseOutputBuffer(outIndex, false)
                        if (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM != 0) outputDone = true
                    }
                }
            }
        } finally {
            runCatching { codec.stop() }; codec.release()
            runCatching { if (muxing) muxer.stop() }; muxer.release()
            bitmap.recycle()
        }
    }

    private val bg = Paint()
    private val big = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; textSize = 120f; typeface = Typeface.MONOSPACE; textAlign = Paint.Align.CENTER }
    private val small = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; textSize = 28f; textAlign = Paint.Align.CENTER }

    private fun drawFrame(c: Canvas, w: Int, h: Int, t: Double, frame: Int) {
        val seg = SampleProjectFactory.videoSegments.firstOrNull { t >= it.start && t < it.end } ?: SampleProjectFactory.videoSegments.last()
        bg.color = when (SampleProjectFactory.videoSegments.indexOf(seg)) { 0 -> 0xFF2E4A6B.toInt(); 1 -> 0xFF4A3B2E.toInt(); else -> 0xFF2E5B3F.toInt() }
        c.drawRect(0f, 0f, w.toFloat(), h.toFloat(), bg)
        c.drawText(TimeFormat.clock(t), w / 2f, h / 2f + 40f, big)
        c.drawText(seg.caption, w / 2f, 70f, small)
        c.drawText("SAMPLE – synthetic footage · frame $frame", w / 2f, h - 30f, small)
    }

    /** ARGB → YUV 4:2:0 into whatever plane layout the encoder exposes. */
    private fun writeYuv(image: android.media.Image, argb: IntArray, w: Int, h: Int) {
        val planes = image.planes
        val y = planes[0]; val u = planes[1]; val v = planes[2]
        val yBuf = y.buffer; val uBuf = u.buffer; val vBuf = v.buffer
        for (row in 0 until h) {
            for (col in 0 until w) {
                val p = argb[row * w + col]
                val r = (p shr 16) and 0xFF; val g = (p shr 8) and 0xFF; val b = p and 0xFF
                val yy = ((66 * r + 129 * g + 25 * b + 128) shr 8) + 16
                yBuf.put(row * y.rowStride + col * y.pixelStride, yy.coerceIn(0, 255).toByte())
                if (row % 2 == 0 && col % 2 == 0) {
                    val uu = ((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128
                    val vv = ((112 * r - 94 * g - 18 * b + 128) shr 8) + 128
                    uBuf.put((row / 2) * u.rowStride + (col / 2) * u.pixelStride, uu.coerceIn(0, 255).toByte())
                    vBuf.put((row / 2) * v.rowStride + (col / 2) * v.pixelStride, vv.coerceIn(0, 255).toByte())
                }
            }
        }
    }
}
