package com.roomscan.android.export

import android.content.Context
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Path
import android.graphics.pdf.PdfDocument
import android.text.Layout
import android.text.StaticLayout
import android.text.TextPaint
import com.roomscan.android.R
import com.roomscan.core.BookmarkService
import com.roomscan.core.LengthUnit
import com.roomscan.core.LinkTarget
import com.roomscan.core.MeasurementCsv
import com.roomscan.core.OpeningKind
import com.roomscan.core.PlanMath
import com.roomscan.core.PlanModel
import com.roomscan.core.PlanTransform
import com.roomscan.core.Point2D
import com.roomscan.core.SurveyProject
import com.roomscan.core.TimeFormat
import com.roomscan.core.Units
import java.io.File

/**
 * A3 landscape PDF: page 1 is the dimensioned plan (same PlanTransform as the
 * screen), the following pages hold the measurement tables. Text goes through
 * StaticLayout so Arabic names are shaped and ordered correctly.
 */
object PdfPlanRenderer {
    private const val W = 1191   // A3 landscape, points
    private const val H = 842
    private const val M = 36f

    fun render(context: Context, p: SurveyProject, roomUnit: LengthUnit, out: File) {
        val doc = PdfDocument()
        try {
            var pageNo = 1
            val first = doc.startPage(PdfDocument.PageInfo.Builder(W, H, pageNo).create())
            drawPlanPage(context, first.canvas, p)
            doc.finishPage(first)

            val rows = tableRows(context, p, roomUnit)
            var index = 0
            while (index < rows.size || index == 0) {
                pageNo++
                val page = doc.startPage(PdfDocument.PageInfo.Builder(W, H, pageNo).create())
                index = drawTablePage(context, page.canvas, p, rows, index)
                doc.finishPage(page)
                if (rows.isEmpty()) break
            }
            out.outputStream().use { doc.writeTo(it) }
        } finally {
            doc.close()
        }
    }

    private fun text(c: Canvas, s: String, x: Float, y: Float, width: Float, size: Float, color: Int = Color.BLACK, bold: Boolean = false,
                     align: Layout.Alignment = Layout.Alignment.ALIGN_NORMAL): Float {
        val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { textSize = size; this.color = color; isFakeBoldText = bold }
        val layout = StaticLayout.Builder.obtain(s, 0, s.length, paint, width.toInt().coerceAtLeast(1)).setAlignment(align).build()
        c.save(); c.translate(x, y); layout.draw(c); c.restore()
        return layout.height.toFloat()
    }

    private fun drawPlanPage(context: Context, c: Canvas, p: SurveyProject) {
        var y = M
        y += text(c, p.name, M, y, W - 2 * M, 22f, bold = true)
        val sub = buildString {
            append(context.getString(R.string.pdf_subtitle))
            if (p.isSample) append(" · ").append(context.getString(R.string.sample_badge))
        }
        y += text(c, sub, M, y, W - 2 * M, 11f, Color.DKGRAY) + 8f

        val bounds = PlanModel.bounds(p)
        val area = android.graphics.RectF(M, y, W - M, H - M - 40f)
        if (bounds == null) {
            text(c, context.getString(R.string.plan_empty), M, y + 20f, W - 2 * M, 14f)
            return
        }
        val t = PlanTransform.fit(bounds, area.width().toDouble(), area.height().toDouble(), 30.0)
        fun v(pt: Point2D): Pair<Float, Float> { val o = t.toView(pt); return (o.x.toFloat() + area.left) to (o.y.toFloat() + area.top) }

        val fill = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFFEAF2FF.toInt(); style = Paint.Style.FILL }
        val wall = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = 0xFF1D2B3A.toInt(); strokeWidth = 3f; style = Paint.Style.STROKE }
        val dashed = Paint(wall).apply { pathEffect = DashPathEffect(floatArrayOf(10f, 7f), 0f) }
        for (room in p.rooms) {
            if (room.floorPolygon.size < 3) continue
            val path = Path()
            room.floorPolygon.forEachIndexed { i, pt -> val (x, yy) = v(pt); if (i == 0) path.moveTo(x, yy) else path.lineTo(x, yy) }
            path.close()
            c.drawPath(path, fill)
            PlanMath.centroid(room.floorPolygon)?.let { cen ->
                val (x, yy) = v(cen)
                val label = room.name + (Units.formatArea(room.floorAreaM2)?.let { "\n$it m²" } ?: "")
                text(c, label, x - 80f, yy - 12f, 160f, 10f, 0xFF3B5576.toInt(), bold = true, align = Layout.Alignment.ALIGN_CENTER)
            }
        }
        for (w in p.walls) {
            val (x1, y1) = v(w.start); val (x2, y2) = v(w.end)
            c.drawLine(x1, y1, x2, y2, if (w.dimensions.scan?.isPartiallyObserved == true) dashed else wall)
        }
        val labelPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 9f; textAlign = Paint.Align.CENTER }
        for (label in PlanModel.wallLabels(p)) {
            val mm = label.millimeters ?: continue
            val (x, yy) = v(label.anchor)
            labelPaint.color = if (label.isVerified) 0xFF1E7B34.toInt() else 0xFF1D2B3A.toInt()
            c.save(); c.rotate(Math.toDegrees(label.angle).toFloat(), x, yy)
            c.drawText(if (label.isVerified) "✓$mm" else "$mm", x, yy + 3f, labelPaint)
            c.restore()
        }
        val gap = Paint(Paint.ANTI_ALIAS_FLAG).apply { color = Color.WHITE; strokeWidth = 7f }
        for (o in p.openings) {
            val (x1, y1) = v(o.start); val (x2, y2) = v(o.end)
            val color = when (o.kind) { OpeningKind.door -> 0xFFC0392B.toInt(); OpeningKind.window -> 0xFF2E86DE.toInt(); else -> 0xFF7F8C8D.toInt() }
            c.drawLine(x1, y1, x2, y2, gap)
            c.drawLine(x1, y1, x2, y2, Paint(Paint.ANTI_ALIAS_FLAG).apply { this.color = color; strokeWidth = 4f })
            val (cx, cy) = v(o.center)
            val w = o.dimensions.verified?.widthMM?.let { "✓$it" } ?: o.dimensions.scan?.widthMM?.toString() ?: "—"
            text(c, "${o.name}\n$w", cx + 4f, cy + 2f, 90f, 8.5f, color, bold = true)
        }
        text(c, context.getString(R.string.pdf_legend), M, H - M - 30f, W - 2 * M, 9f, Color.DKGRAY)
    }

    private data class Row(val cells: List<String>, val header: Boolean = false)

    private fun tableRows(context: Context, p: SurveyProject, roomUnit: LengthUnit): List<Row> {
        val rows = mutableListOf<Row>()
        fun time(t: LinkTarget) = BookmarkService.bookmarkFor(t, p)?.let { TimeFormat.clock(it.mediaTime) } ?: ""
        rows += Row(context.resources.getStringArray(R.array.pdf_room_columns).toList(), header = true)
        for (r in p.rooms.sortedBy { it.scanIndex }) rows += Row(listOf(
            r.name, Units.formatArea(r.floorAreaM2) ?: "—",
            Units.format(r.maxWallHeightM, roomUnit) ?: "—", r.verifiedCeilingHeightMM?.let { "✓$it" } ?: "—", r.alignment.name, time(LinkTarget.Room(r.id)), r.notes,
        ))
        rows += Row(context.resources.getStringArray(R.array.pdf_item_columns).toList(), header = true)
        for (o in p.openings.sortedWith(compareBy({ it.kind.name }, { it.number }))) {
            val d = o.dimensions
            rows += Row(listOf(
                o.name, p.room(o.roomId)?.name ?: "", d.scan?.widthMM?.toString() ?: "—", d.scan?.heightMM?.toString() ?: "—",
                d.verified?.widthMM?.toString() ?: "", d.verified?.heightMM?.toString() ?: "", d.widthDeltaMM?.let { if (it > 0) "+$it" else "$it" } ?: "",
                d.manufacturing?.widthMM?.toString() ?: "", d.manufacturing?.heightMM?.toString() ?: "",
                MeasurementCsv.status(d.scan), time(LinkTarget.Opening(o.id)),
            ))
        }
        for (w in p.walls) {
            val d = w.dimensions
            rows += Row(listOf(
                w.name, p.room(w.roomId)?.name ?: "", d.scan?.widthMM?.toString() ?: "—", d.scan?.heightMM?.toString() ?: "—",
                d.verified?.widthMM?.toString() ?: "", d.verified?.heightMM?.toString() ?: "", d.widthDeltaMM?.let { if (it > 0) "+$it" else "$it" } ?: "",
                d.manufacturing?.widthMM?.toString() ?: "", d.manufacturing?.heightMM?.toString() ?: "",
                MeasurementCsv.status(d.scan), time(LinkTarget.Wall(w.id)),
            ))
        }
        return rows
    }

    /** Draws rows from [start]; returns the index of the first row that did not fit. */
    private fun drawTablePage(context: Context, c: Canvas, p: SurveyProject, rows: List<Row>, start: Int): Int {
        var y = M
        y += text(c, p.name + " · " + context.getString(R.string.pdf_table_title), M, y, W - 2 * M, 16f, bold = true) + 4f
        y += text(c, context.getString(R.string.measure_provenance_note), M, y, W - 2 * M, 9f, Color.DKGRAY) + 8f
        val line = Paint().apply { color = 0xFFDDDDDD.toInt(); strokeWidth = 1f }
        var i = start
        while (i < rows.size) {
            val row = rows[i]
            val colW = (W - 2 * M) / row.cells.size.coerceAtLeast(1)
            val heights = row.cells.mapIndexed { k, s ->
                val paint = TextPaint(Paint.ANTI_ALIAS_FLAG).apply { textSize = 9f; isFakeBoldText = row.header }
                StaticLayout.Builder.obtain(s, 0, s.length, paint, (colW - 6).toInt().coerceAtLeast(1)).build().height
            }
            val h = (heights.maxOrNull() ?: 12) + 6f
            if (y + h > H - M) break
            row.cells.forEachIndexed { k, s -> text(c, s, M + k * colW + 3f, y + 3f, colW - 6f, 9f, if (row.header) Color.DKGRAY else Color.BLACK, bold = row.header) }
            y += h
            c.drawLine(M, y, W - M, y, line)
            i++
        }
        return if (i == start && start < rows.size) start + 1 else i   // always make progress
    }
}
