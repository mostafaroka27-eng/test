package com.roomscan.android.capture

import android.opengl.GLES11Ext
import android.opengl.GLES20
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Frame
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer
import kotlin.math.abs

/**
 * Draws the ARCore camera image (external OES texture) as a full-screen quad.
 * The same texture is drawn twice per frame: cropped to the screen for the
 * preview, and uncropped (whole sensor image, upright) for the MP4.
 */
class BackgroundRenderer {
    var textureId = -1
        private set
    private var program = 0
    private var aPos = 0
    private var aUv = 0
    private var uTex = 0

    /** NDC quad: (-1,-1) (1,-1) (-1,1) (1,1), drawn as a triangle strip. */
    private val ndcQuad = floatArrayOf(-1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f)
    private val quad: FloatBuffer = floatBuffer(ndcQuad)
    private val screenUv: FloatBuffer = floatBuffer(FloatArray(8))
    private val fullUv: FloatBuffer = floatBuffer(FloatArray(8))
    private val screenUvArray = FloatArray(8)

    /** True when screen X runs along the texture's V axis (portrait on most phones). */
    var screenXAlongTextureV = false
        private set
    var hasUv = false
        private set

    fun createOnGlThread() {
        val tex = IntArray(1)
        GLES20.glGenTextures(1, tex, 0)
        textureId = tex[0]
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
        GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)

        program = link(VERTEX, FRAGMENT)
        aPos = GLES20.glGetAttribLocation(program, "a_Position")
        aUv = GLES20.glGetAttribLocation(program, "a_TexCoord")
        uTex = GLES20.glGetUniformLocation(program, "u_Texture")
    }

    /** Recomputes texture coordinates when the display geometry changed. */
    fun updateUv(frame: Frame) {
        if (!frame.hasDisplayGeometryChanged() && hasUv) return
        frame.transformCoordinates2d(
            Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES, ndcQuad,
            Coordinates2d.TEXTURE_NORMALIZED, screenUvArray,
        )
        screenUv.position(0); screenUv.put(screenUvArray); screenUv.position(0)

        // Expand the screen crop to the whole texture, keeping orientation:
        // each texture axis is remapped from [min,max] of the crop to [0,1].
        val us = floatArrayOf(screenUvArray[0], screenUvArray[2], screenUvArray[4], screenUvArray[6])
        val vs = floatArrayOf(screenUvArray[1], screenUvArray[3], screenUvArray[5], screenUvArray[7])
        val uMin = us.min(); val uMax = us.max(); val vMin = vs.min(); val vMax = vs.max()
        val full = FloatArray(8)
        for (i in 0 until 4) {
            full[2 * i] = if (uMax - uMin > 1e-6f) (us[i] - uMin) / (uMax - uMin) else us[i]
            full[2 * i + 1] = if (vMax - vMin > 1e-6f) (vs[i] - vMin) / (vMax - vMin) else vs[i]
        }
        fullUv.position(0); fullUv.put(full); fullUv.position(0)
        // Corner 0 → corner 1 is a step along screen X. If V changes there, screen X follows V.
        screenXAlongTextureV = abs(vs[1] - vs[0]) > abs(us[1] - us[0])
        hasUv = true
    }

    fun drawScreen() = draw(screenUv)
    fun drawFullImage() = draw(fullUv)

    private fun draw(uv: FloatBuffer) {
        if (!hasUv) return
        GLES20.glDisable(GLES20.GL_DEPTH_TEST)
        GLES20.glDepthMask(false)
        GLES20.glUseProgram(program)
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
        GLES20.glUniform1i(uTex, 0)
        quad.position(0)
        GLES20.glVertexAttribPointer(aPos, 2, GLES20.GL_FLOAT, false, 0, quad)
        uv.position(0)
        GLES20.glVertexAttribPointer(aUv, 2, GLES20.GL_FLOAT, false, 0, uv)
        GLES20.glEnableVertexAttribArray(aPos)
        GLES20.glEnableVertexAttribArray(aUv)
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
        GLES20.glDisableVertexAttribArray(aPos)
        GLES20.glDisableVertexAttribArray(aUv)
        GLES20.glDepthMask(true)
        GLES20.glEnable(GLES20.GL_DEPTH_TEST)
    }

    companion object {
        private const val VERTEX = """
            attribute vec4 a_Position;
            attribute vec2 a_TexCoord;
            varying vec2 v_TexCoord;
            void main() { gl_Position = a_Position; v_TexCoord = a_TexCoord; }
        """
        private const val FRAGMENT = """
            #extension GL_OES_EGL_image_external : require
            precision mediump float;
            varying vec2 v_TexCoord;
            uniform samplerExternalOES u_Texture;
            void main() { gl_FragColor = texture2D(u_Texture, v_TexCoord); }
        """

        private fun floatBuffer(a: FloatArray): FloatBuffer =
            ByteBuffer.allocateDirect(a.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply { put(a); position(0) }

        private fun compile(type: Int, src: String): Int {
            val s = GLES20.glCreateShader(type)
            GLES20.glShaderSource(s, src)
            GLES20.glCompileShader(s)
            val ok = IntArray(1)
            GLES20.glGetShaderiv(s, GLES20.GL_COMPILE_STATUS, ok, 0)
            check(ok[0] != 0) { "Shader error: " + GLES20.glGetShaderInfoLog(s) }
            return s
        }

        private fun link(vs: String, fs: String): Int {
            val p = GLES20.glCreateProgram()
            GLES20.glAttachShader(p, compile(GLES20.GL_VERTEX_SHADER, vs))
            GLES20.glAttachShader(p, compile(GLES20.GL_FRAGMENT_SHADER, fs))
            GLES20.glLinkProgram(p)
            val ok = IntArray(1)
            GLES20.glGetProgramiv(p, GLES20.GL_LINK_STATUS, ok, 0)
            check(ok[0] != 0) { "Link error: " + GLES20.glGetProgramInfoLog(p) }
            return p
        }
    }
}
