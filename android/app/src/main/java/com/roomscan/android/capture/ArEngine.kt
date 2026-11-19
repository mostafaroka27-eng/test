package com.roomscan.android.capture

import android.app.Activity
import android.content.Context
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.opengl.Matrix
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.view.Surface
import android.view.WindowManager
import com.google.ar.core.Config
import com.google.ar.core.DepthPoint
import com.google.ar.core.Frame
import com.google.ar.core.Plane
import com.google.ar.core.Point
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import com.roomscan.core.FrameAdmission
import com.roomscan.core.HitQuality
import com.roomscan.core.RecordingClock
import com.roomscan.core.TapPoint
import com.roomscan.core.Vec3
import com.roomscan.core.VideoInterruption
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import java.io.File
import java.util.concurrent.ConcurrentLinkedQueue
import javax.microedition.khronos.egl.EGL10
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.egl.EGLDisplay
import javax.microedition.khronos.opengles.GL10

/** What the overlay needs from the latest AR frame. */
data class ArFrameState(
    val tracking: TrackingState = TrackingState.PAUSED,
    val failure: TrackingFailureReason = TrackingFailureReason.NONE,
    /** Column-major view-projection matrix of the latest frame. */
    val viewProjection: FloatArray? = null,
    val viewportWidth: Int = 0,
    val viewportHeight: Int = 0,
    /** Where the centre crosshair hits right now, if anywhere. */
    val reticle: TapPoint? = null,
    val recordingMediaTime: Double? = null,
    val depthSupported: Boolean = false,
) {
    /** Projects a world point to view pixels; null when behind the camera. */
    fun project(p: Vec3): Pair<Float, Float>? {
        val m = viewProjection ?: return null
        val v = floatArrayOf(p.x.toFloat(), p.y.toFloat(), p.z.toFloat(), 1f)
        val out = FloatArray(4)
        Matrix.multiplyMV(out, 0, m, 0, v, 0)
        if (out[3] <= 1e-4f) return null
        val x = out[0] / out[3]; val y = out[1] / out[3]
        return ((x + 1f) / 2f * viewportWidth) to ((1f - y) / 2f * viewportHeight)
    }
}

/**
 * Owns the ARCore session, the GL view and the walkthrough recording.
 * Every ARCore call happens on the GL thread; results come back on the main thread.
 */
class ArEngine(private val context: Context) : GLSurfaceView.Renderer {
    interface Listener {
        /** The recording stopped by itself (app left the screen, disk full, encoder error). */
        fun onVideoStopped(result: VideoRecorder.Result, reason: String, clock: RecordingClock, width: Int, height: Int)
        fun onVideoStarted(width: Int, height: Int)
        fun onArError(message: String)
    }

    var listener: Listener? = null
    val view: GLSurfaceView = GLSurfaceView(context).apply {
        preserveEGLContextOnPause = true
        setEGLContextClientVersion(2)
        setEGLConfigChooser(RecordableConfigChooser())
        setRenderer(this@ArEngine)
        renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
        setWillNotDraw(false)
    }

    private val main = Handler(Looper.getMainLooper())
    private val background = BackgroundRenderer()
    @Volatile private var session: Session? = null
    private var textureSet = false
    private var viewportW = 0
    private var viewportH = 0
    private var displayRotation = Surface.ROTATION_0
    private var geometryDirty = true

    private val _state = MutableStateFlow(ArFrameState())
    val state: StateFlow<ArFrameState> = _state

    private data class TapRequest(val x: Float, val y: Float, val callback: (TapPoint?) -> Unit)
    private val taps = ConcurrentLinkedQueue<TapRequest>()
    private val glTasks = ConcurrentLinkedQueue<() -> Unit>()

    /** Times the AR world origin may have changed (a new session). Rooms in different epochs are not aligned. */
    @Volatile var sessionEpoch = 0; private set
    @Volatile var lastFrameHostTime: Double? = null; private set
    private var lastTrackingCheckHost: Double? = null
    @Volatile var trackingLimitedSeconds = 0.0; private set

    // Recording state (GL thread only, except the volatile clock reads).
    private var pendingRecordingFile: File? = null
    private var recorder: VideoRecorder? = null
    @Volatile var clock: RecordingClock? = null; private set
    private var admission = FrameAdmission(30.0)

    val isRecording: Boolean get() = recorder != null || pendingRecordingFile != null

    // ------------------------------------------------------------------ lifecycle (main thread)

    /** Creates the session once; throws ARCore's Unavailable* exceptions for the caller to explain. */
    fun ensureSession(): Session {
        session?.let { return it }
        val s = Session(context)
        val config = Config(s).apply {
            planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
            focusMode = Config.FocusMode.AUTO
            updateMode = Config.UpdateMode.LATEST_CAMERA_IMAGE
            lightEstimationMode = Config.LightEstimationMode.DISABLED
            depthMode = if (s.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) Config.DepthMode.AUTOMATIC else Config.DepthMode.DISABLED
        }
        s.configure(config)
        _state.value = _state.value.copy(depthSupported = config.depthMode == Config.DepthMode.AUTOMATIC)
        session = s
        textureSet = false
        sessionEpoch++
        return s
    }

    fun resume() {
        val s = session ?: return
        try {
            s.resume()
        } catch (e: CameraNotAvailableException) {
            listener?.onArError("camera")
            return
        }
        view.onResume()
    }

    /** Leaving the screen stops the video (the file stays playable), like the iPhone app. */
    fun pause() {
        view.onPause()                       // the GL thread is idle after this returns
        if (isRecording) stopNow("appBackgrounded")
        session?.pause()
    }

    fun close() {
        session?.close()
        session = null
    }

    // ------------------------------------------------------------------ requests (main thread)

    /** Resolves a screen point (view pixels) to a 3D point on the next frame. */
    fun hitTest(x: Float, y: Float, callback: (TapPoint?) -> Unit) { taps += TapRequest(x, y, callback) }

    fun hitTestCenter(callback: (TapPoint?) -> Unit) = hitTest(viewportW / 2f, viewportH / 2f, callback)

    /** Starts recording on the next tracked frame. Media time 0 = that frame. */
    fun startRecording(file: File) { glTasks += { if (recorder == null) { pendingRecordingFile = file; admission = FrameAdmission(30.0) } } }

    /** Stops the recording; [onDone] runs on the main thread with the result. */
    fun stopRecording(onDone: (VideoRecorder.Result?, RecordingClock?, Int, Int) -> Unit) {
        glTasks += {
            val r = recorder; val c = clock
            recorder = null; pendingRecordingFile = null
            r?.releaseGl()
            Thread {
                val result = r?.finish()
                main.post { onDone(result, c, r?.width ?: 0, r?.height ?: 0) }
            }.start()
        }
    }

    /** Media time of the newest frame, for a bookmark pressed now. */
    fun mediaTimeNow(): Double? {
        val c = clock ?: return null
        val h = lastFrameHostTime ?: return null
        return c.mediaTime(h)
    }

    fun resetTrackingCounter() { trackingLimitedSeconds = 0.0 }

    // ------------------------------------------------------------------ GL thread

    override fun onSurfaceCreated(gl: GL10?, config: javax.microedition.khronos.egl.EGLConfig?) {
        GLES20.glClearColor(0f, 0f, 0f, 1f)
        background.createOnGlThread()
        textureSet = false
    }

    override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
        GLES20.glViewport(0, 0, width, height)
        viewportW = width; viewportH = height
        displayRotation = currentRotation()
        geometryDirty = true
    }

    override fun onDrawFrame(gl: GL10?) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
        while (true) { (glTasks.poll() ?: break).invoke() }
        val s = session ?: return
        if (!textureSet) { s.setCameraTextureName(background.textureId); textureSet = true }
        if (geometryDirty) { s.setDisplayGeometry(displayRotation, viewportW, viewportH); geometryDirty = false }

        val frame: Frame = try { s.update() } catch (e: Exception) { return }
        if (frame.timestamp == 0L) return   // camera not ready yet
        background.updateUv(frame)
        background.drawScreen()

        val camera = frame.camera
        val host = frame.timestamp / 1e9
        val prevHost = lastTrackingCheckHost
        if (prevHost != null && camera.trackingState != TrackingState.TRACKING && host > prevHost) trackingLimitedSeconds += host - prevHost
        lastTrackingCheckHost = host
        lastFrameHostTime = host

        var viewProjection: FloatArray? = null
        if (camera.trackingState == TrackingState.TRACKING) {
            val viewM = FloatArray(16); val proj = FloatArray(16)
            camera.getViewMatrix(viewM, 0)
            camera.getProjectionMatrix(proj, 0, 0.05f, 50f)
            viewProjection = FloatArray(16).also { Matrix.multiplyMM(it, 0, proj, 0, viewM, 0) }
        }

        while (true) {
            val t = taps.poll() ?: break
            val result = if (camera.trackingState == TrackingState.TRACKING) resolve(frame, t.x, t.y) else null
            main.post { t.callback(result) }
        }
        val reticle = if (camera.trackingState == TrackingState.TRACKING) resolve(frame, viewportW / 2f, viewportH / 2f) else null

        record(frame, host)

        _state.value = ArFrameState(
            tracking = camera.trackingState,
            failure = camera.trackingFailureReason,
            viewProjection = viewProjection,
            viewportWidth = viewportW,
            viewportHeight = viewportH,
            reticle = reticle,
            recordingMediaTime = clock?.mediaTime(host)?.takeIf { recorder != null },
            depthSupported = _state.value.depthSupported,
        )
    }

    /** Best hit at a view point: plane inside its polygon, then depth, then a feature point. */
    private fun resolve(frame: Frame, x: Float, y: Float): TapPoint? {
        val hits = try { frame.hitTest(x, y) } catch (e: Exception) { return null }
        var best: TapPoint? = null
        for (h in hits) {
            val pose = h.hitPose
            val q = when (val t = h.trackable) {
                is Plane -> if (t.isPoseInPolygon(pose) && t.subsumedBy == null) HitQuality.plane else null
                is DepthPoint -> HitQuality.depth
                is Point -> HitQuality.point
                else -> null
            } ?: continue
            val p = TapPoint(Vec3(pose.tx().toDouble(), pose.ty().toDouble(), pose.tz().toDouble()), q)
            if (best == null || q.ordinal < best.quality.ordinal) best = p
            if (q == HitQuality.plane) break
        }
        return best
    }

    private fun record(frame: Frame, host: Double) {
        pendingRecordingFile?.let { file ->
            if (!background.hasUv) return@let
            val dims = frame.camera.textureIntrinsics.imageDimensions
            val (w, h) = VideoRecorder.outputSize(dims[0], dims[1], rotated = background.screenXAlongTextureV)
            pendingRecordingFile = null
            try {
                val r = VideoRecorder(file, w, h)
                r.start()
                recorder = r
                clock = RecordingClock().also { it.start(host) }
                main.post { listener?.onVideoStarted(w, h) }
            } catch (e: Exception) {
                main.post { listener?.onVideoStopped(VideoRecorder.Result.Failed(e.message ?: "encoder", null), "encoderUnavailable", RecordingClock(), w, h) }
            }
        }
        val r = recorder ?: return
        val c = clock ?: return
        r.failed?.let { stopNow("writeFailed"); return }
        when (val d = admission.decide(host, c)) {
            is FrameAdmission.Decision.Write -> {
                if (r.encode(d.mediaTime) { background.drawFullImage() }) admission.didWrite(d.mediaTime) else admission.didDropAtEncoder()
                GLES20.glViewport(0, 0, viewportW, viewportH)
            }
            else -> Unit
        }
    }

    /**
     * Stops from inside the engine and reports through the listener. Called on
     * the GL thread, or on the main thread after the GL thread was paused.
     */
    private fun stopNow(reason: String) {
        val r = recorder; val c = clock
        recorder = null; pendingRecordingFile = null
        if (r != null && c != null) {
            r.releaseGl()
            Thread {
                val result = r.finish()
                main.post { listener?.onVideoStopped(result, reason, c, r.width, r.height) }
            }.start()
        }
    }

    private fun currentRotation(): Int =
        if (Build.VERSION.SDK_INT >= 30) (context as? Activity)?.display?.rotation ?: Surface.ROTATION_0
        else @Suppress("DEPRECATION") (context.getSystemService(Context.WINDOW_SERVICE) as WindowManager).defaultDisplay.rotation

    /** Asks for an RGBA8888 + depth config that the video encoder surface can share. */
    private class RecordableConfigChooser : GLSurfaceView.EGLConfigChooser {
        override fun chooseConfig(egl: EGL10, display: EGLDisplay): EGLConfig {
            val recordable = 0x3142 // EGL_RECORDABLE_ANDROID
            val renderable = 4      // EGL_OPENGL_ES2_BIT
            fun choose(withRecordable: Boolean): EGLConfig? {
                val attrs = mutableListOf(
                    EGL10.EGL_RED_SIZE, 8, EGL10.EGL_GREEN_SIZE, 8, EGL10.EGL_BLUE_SIZE, 8, EGL10.EGL_ALPHA_SIZE, 8,
                    EGL10.EGL_DEPTH_SIZE, 16, EGL10.EGL_RENDERABLE_TYPE, renderable,
                )
                if (withRecordable) { attrs += recordable; attrs += 1 }
                attrs += EGL10.EGL_NONE
                val configs = arrayOfNulls<EGLConfig>(1)
                val n = IntArray(1)
                return if (egl.eglChooseConfig(display, attrs.toIntArray(), configs, 1, n) && n[0] > 0) configs[0] else null
            }
            return choose(true) ?: choose(false) ?: error("No suitable EGL config")
        }
    }
}

/** For the interruptions list in VideoInfo. */
fun RecordingClock.interruptionList(): List<VideoInterruption> = interruptions
