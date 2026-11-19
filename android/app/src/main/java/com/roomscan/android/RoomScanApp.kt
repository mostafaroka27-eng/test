package com.roomscan.android

import android.app.Application
import android.content.Context
import android.os.Build
import android.os.StatFs
import com.roomscan.core.LengthUnit
import com.roomscan.core.ProjectStore
import java.io.File

class RoomScanApp : Application() {
    lateinit var repository: ProjectRepository
        private set

    override fun onCreate() {
        super.onCreate()
        repository = ProjectRepository(this, ProjectStore(File(filesDir, "Projects")))
    }
}

val Context.repository: ProjectRepository get() = (applicationContext as RoomScanApp).repository

/** Small persisted preferences (units, lead-in). Language is handled by AppCompat. */
class AppSettings(context: Context) {
    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)

    var roomUnit: LengthUnit
        get() = runCatching { LengthUnit.valueOf(prefs.getString("roomUnit", LengthUnit.meters.name)!!) }.getOrDefault(LengthUnit.meters)
        set(v) = prefs.edit().putString("roomUnit", v.name).apply()

    /** Seconds of video shown before a bookmarked moment when a plan item is opened. */
    var preRollSeconds: Double
        get() = prefs.getFloat("preRoll", 0f).toDouble()
        set(v) = prefs.edit().putFloat("preRoll", v.toFloat()).apply()
}

object DeviceInfo {
    val model: String get() = "${Build.MANUFACTURER} ${Build.MODEL} (Android ${Build.VERSION.RELEASE})"
    fun freeBytes(dir: File): Long = runCatching { StatFs(dir.path).availableBytes }.getOrDefault(Long.MAX_VALUE)
    fun appVersion(context: Context): String = runCatching {
        val info = context.packageManager.getPackageInfo(context.packageName, 0)
        "${info.versionName} (${if (Build.VERSION.SDK_INT >= 28) info.longVersionCode else @Suppress("DEPRECATION") info.versionCode.toLong()}) Android"
    }.getOrDefault("Android")
}
