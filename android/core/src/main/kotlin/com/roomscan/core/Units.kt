package com.roomscan.core

import java.math.BigDecimal
import java.math.RoundingMode
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.pow
import kotlin.math.sign

enum class LengthUnit { millimeters, meters }

/** Mirrors Units.swift: scan lengths in meters (Double), typed sizes in whole mm. */
object Units {
    /** Meters → whole millimeters, rounding half away from zero (Swift `.toNearestOrAwayFromZero`). */
    fun millimetersFromMeters(meters: Double): Int = roundHalfAway(meters * 1000).toInt()

    fun metersFromMillimeters(mm: Int): Double = mm / 1000.0

    fun format(meters: Double?, unit: LengthUnit, decimals: Int = 2): String? {
        if (meters == null || !meters.isFinite()) return null
        return when (unit) {
            LengthUnit.millimeters -> millimetersFromMeters(meters).toString()
            LengthUnit.meters -> formatDecimal(meters, decimals)
        }
    }

    fun formatMillimeters(mm: Int?, unit: LengthUnit, decimals: Int = 3): String? {
        if (mm == null) return null
        return when (unit) {
            LengthUnit.millimeters -> mm.toString()
            LengthUnit.meters -> formatDecimal(metersFromMillimeters(mm), decimals)
        }
    }

    fun formatArea(squareMeters: Double?): String? =
        if (squareMeters == null || !squareMeters.isFinite()) null else formatDecimal(squareMeters, 2)

    /** Accepts "2150", "2 150", "2,150", "٢١٥٠", "905 mm", "٩٠٥ مم". Rejects ≤0, decimals, >100 m. */
    fun parseMillimeters(text: String): Int? {
        var s = normalizeDigits(text)
        for (suffix in listOf("mm", "MM", "مم")) if (s.endsWith(suffix)) s = s.dropLast(suffix.length)
        s = s.replace(" ", "").replace(" ", "").replace(",", "").replace("٬", "")
        if (s.isEmpty() || !s.all { it in '0'..'9' }) return null
        val v = s.toIntOrNull() ?: return null
        return if (v in 1..100_000) v else null
    }

    /** "2.45", "2,45 m", "٢٫٧٥" → millimeters. */
    fun parseMetersToMillimeters(text: String): Int? {
        var s = normalizeDigits(text).trim()
        for (suffix in listOf("m", "M", "م")) if (s.endsWith(suffix)) s = s.dropLast(suffix.length).trim()
        s = s.replace(",", ".").replace("٫", ".")
        val v = s.toDoubleOrNull() ?: return null
        if (v <= 0 || v > 100) return null
        return millimetersFromMeters(v)
    }

    internal fun normalizeDigits(text: String): String = text.trim().map { c ->
        when (c) {
            in '٠'..'٩' -> '0' + (c - '٠')
            in '۰'..'۹' -> '0' + (c - '۰')
            else -> c
        }
    }.joinToString("")

    fun formatDecimal(value: Double, decimals: Int): String {
        val factor = 10.0.pow(decimals)
        val rounded = roundHalfAway(value * factor) / factor
        return BigDecimal(rounded).setScale(decimals, RoundingMode.HALF_UP).toPlainString()
    }

    private fun roundHalfAway(x: Double): Double = sign(x) * floor(abs(x) + 0.5)
}

object TimeFormat {
    /** m:ss.t, truncated to tenths, like TimeFormat.swift. */
    fun clock(seconds: Double): String {
        if (!seconds.isFinite() || seconds < 0) return "--:--"
        val tenths = floor(seconds * 10).toLong()
        val minutes = tenths / 600
        val secs = (tenths / 10) % 60
        val t = tenths % 10
        return String.format(Locale.US, "%d:%02d.%d", minutes, secs, t)
    }
}
