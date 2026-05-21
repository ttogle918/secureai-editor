package io.secureai.android.ui.dashboard

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

private val SCORE_COLOR_RED = Color(0xFFE53935)
private val SCORE_COLOR_YELLOW = Color(0xFFFDD835)
private val SCORE_COLOR_GREEN = Color(0xFF43A047)
private val GAUGE_TRACK_COLOR = Color(0xFFE0E0E0)

private const val GAUGE_START_ANGLE = 135f
private const val GAUGE_SWEEP_ANGLE = 270f

/** 점수에 따라 색상을 반환한다. 0-40: 빨강, 41-70: 노랑, 71-100: 초록 */
private fun scoreColor(score: Int): Color = when {
    score <= 40 -> SCORE_COLOR_RED
    score <= 70 -> SCORE_COLOR_YELLOW
    else -> SCORE_COLOR_GREEN
}

/**
 * 보안 점수를 원형 게이지로 표시하는 컴포저블.
 *
 * Canvas API로 배경 트랙과 점수 비례 원호를 그린다.
 * 중앙에는 숫자 점수를 표시한다.
 */
@Composable
fun SecurityScoreGauge(
    score: Int,
    modifier: Modifier = Modifier,
    size: Dp = 180.dp,
    strokeWidth: Dp = 16.dp
) {
    val color = scoreColor(score)
    val scoreSweep = GAUGE_SWEEP_ANGLE * (score.coerceIn(0, 100) / 100f)

    Box(
        contentAlignment = Alignment.Center,
        modifier = modifier.size(size)
    ) {
        Canvas(modifier = Modifier.size(size)) {
            val strokePx = strokeWidth.toPx()
            val inset = strokePx / 2f

            // 배경 트랙 (회색 원호)
            drawArc(
                color = GAUGE_TRACK_COLOR,
                startAngle = GAUGE_START_ANGLE,
                sweepAngle = GAUGE_SWEEP_ANGLE,
                useCenter = false,
                style = Stroke(width = strokePx, cap = StrokeCap.Round),
                topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                size = androidx.compose.ui.geometry.Size(
                    this.size.width - strokePx,
                    this.size.height - strokePx
                )
            )

            // 점수 원호 (색상)
            if (scoreSweep > 0f) {
                drawArc(
                    color = color,
                    startAngle = GAUGE_START_ANGLE,
                    sweepAngle = scoreSweep,
                    useCenter = false,
                    style = Stroke(width = strokePx, cap = StrokeCap.Round),
                    topLeft = androidx.compose.ui.geometry.Offset(inset, inset),
                    size = androidx.compose.ui.geometry.Size(
                        this.size.width - strokePx,
                        this.size.height - strokePx
                    )
                )
            }
        }

        Text(
            text = "$score",
            fontSize = 40.sp,
            fontWeight = FontWeight.Bold,
            color = color
        )
    }
}
