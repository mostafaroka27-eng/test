package com.roomscan.android.review

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.gestures.detectTransformGestures
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.roomscan.android.R
import com.roomscan.core.BookmarkService
import com.roomscan.core.LinkTarget
import com.roomscan.core.OpeningKind
import com.roomscan.core.PlanModel
import com.roomscan.core.PlanTransform
import com.roomscan.core.Point2D
import com.roomscan.core.SurveyProject

/** Interactive floor plan: pinch to zoom, drag to pan, tap a door, window, wall or room. */
@Composable
fun PlanView(p: SurveyProject, selected: LinkTarget?, onSelect: (LinkTarget) -> Unit, modifier: Modifier = Modifier) {
    val bounds = PlanModel.bounds(p)
    if (bounds == null) {
        Box(modifier, contentAlignment = Alignment.Center) { Text(stringResource(R.string.plan_empty)) }
        return
    }
    var zoom by remember { mutableFloatStateOf(1f) }
    var pan by remember { mutableStateOf(Offset.Zero) }
    var base by remember { mutableStateOf<PlanTransform?>(null) }
    val measurer = rememberTextMeasurer()
    val small = TextStyle(fontSize = 11.sp, color = Color(0xFF1D2B3A))
    val verifiedStyle = TextStyle(fontSize = 11.sp, color = Color(0xFF1E7B34), fontWeight = FontWeight.Bold)
    val nameStyle = TextStyle(fontSize = 12.sp, color = Color(0xFF3B5576), fontWeight = FontWeight.Bold)
    val labels = remember(p) { PlanModel.wallLabels(p) }

    Column(modifier) {
        Canvas(
            Modifier.weight(1f).fillMaxSize().background(Color.White)
                .pointerInput(p) {
                    detectTransformGestures { _, panChange, zoomChange, _ ->
                        zoom = (zoom * zoomChange).coerceIn(0.5f, 8f)
                        pan += panChange
                    }
                }
                .pointerInput(p, zoom, pan) {
                    detectTapGestures { tap ->
                        val t = base ?: return@detectTapGestures
                        val local = (tap - pan) / zoom
                        val planPoint = t.toPlan(Point2D(local.x.toDouble(), local.y.toDouble()))
                        val tolerance = 28.0 / (t.scale * zoom)
                        PlanModel.hitTest(p, planPoint, tolerance)?.let(onSelect)
                    }
                },
        ) {
            val t = PlanTransform.fit(bounds, size.width.toDouble(), size.height.toDouble(), 48.0).also { base = it }
            fun v(pt: Point2D): Offset { val o = t.toView(pt); return Offset(o.x.toFloat() * zoom + pan.x, o.y.toFloat() * zoom + pan.y) }

            for (room in p.rooms) {
                if (room.floorPolygon.size < 3) continue
                val path = Path().apply {
                    room.floorPolygon.forEachIndexed { i, pt -> val o = v(pt); if (i == 0) moveTo(o.x, o.y) else lineTo(o.x, o.y) }
                    close()
                }
                val isSel = selected == LinkTarget.Room(room.id)
                drawPath(path, if (isSel) Color(0xFFCFE3FF) else Color(0xFFEAF2FF))
                val c = com.roomscan.core.PlanMath.centroid(room.floorPolygon)!!
                val layout = measurer.measure(room.name, nameStyle)
                drawText(layout, topLeft = v(c) - Offset(layout.size.width / 2f, layout.size.height / 2f))
            }
            for (w in p.walls) {
                val partial = w.dimensions.scan?.isPartiallyObserved == true
                val isSel = selected == LinkTarget.Wall(w.id)
                drawLine(if (isSel) Color(0xFF0A7AFF) else Color(0xFF1D2B3A), v(w.start), v(w.end), strokeWidth = if (isSel) 7f else 5f,
                    pathEffect = if (partial) PathEffect.dashPathEffect(floatArrayOf(14f, 10f)) else null)
            }
            for (label in labels) {
                val mm = label.millimeters ?: continue
                val text = if (label.isVerified) "✓$mm" else "$mm"
                val layout = measurer.measure(text, if (label.isVerified) verifiedStyle else small)
                val at = v(label.anchor)
                rotate(Math.toDegrees(label.angle).toFloat(), at) {
                    drawText(layout, topLeft = at - Offset(layout.size.width / 2f, layout.size.height / 2f))
                }
            }
            for (o in p.openings) {
                val isSel = selected == LinkTarget.Opening(o.id)
                val color = when {
                    isSel -> Color(0xFF0A7AFF)
                    o.kind == OpeningKind.door -> Color(0xFFC0392B)
                    o.kind == OpeningKind.window -> Color(0xFF2E86DE)
                    else -> Color(0xFF7F8C8D)
                }
                drawLine(Color.White, v(o.start), v(o.end), strokeWidth = 11f)
                drawLine(color, v(o.start), v(o.end), strokeWidth = if (isSel) 9f else 6f)
                val layout = measurer.measure(o.name, TextStyle(fontSize = 11.sp, color = color, fontWeight = FontWeight.Bold))
                val mid = v(o.center)
                drawText(layout, topLeft = mid + Offset(8f, 6f))
                if (BookmarkService.bookmarkFor(LinkTarget.Opening(o.id), p) != null) {
                    drawCircle(Color(0xFFFF9500), 9f, mid - Offset(14f, 14f))
                }
            }
            drawRect(Color(0x22000000), style = Stroke(1f))
        }
        Text(
            stringResource(R.string.plan_legend),
            style = MaterialTheme.typography.bodySmall,
            modifier = Modifier.padding(horizontal = 16.dp, vertical = 6.dp),
        )
    }
}
