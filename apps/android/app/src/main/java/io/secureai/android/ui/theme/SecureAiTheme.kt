package io.secureai.android.ui.theme

import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val SecureAiLightColors = lightColorScheme(
    primary = Color(0xFF1565C0),         // 딥 블루 — 보안 플랫폼 느낌
    onPrimary = Color.White,
    primaryContainer = Color(0xFFD1E4FF),
    secondary = Color(0xFF455A64),
    onSecondary = Color.White,
    background = Color(0xFFF8F9FA),
    surface = Color.White,
    error = Color(0xFFB00020),
    onError = Color.White
)

private val SecureAiDarkColors = darkColorScheme(
    primary = Color(0xFF90CAF9),
    onPrimary = Color(0xFF003064),
    primaryContainer = Color(0xFF004496),
    secondary = Color(0xFFB0BEC5),
    background = Color(0xFF121212),
    surface = Color(0xFF1E1E1E),
    error = Color(0xFFCF6679),
)

/**
 * SecureAI 앱 전역 Material3 테마.
 * 시스템 다크모드 설정을 따른다.
 */
@Composable
fun SecureAiTheme(
    darkTheme: Boolean = isSystemInDarkTheme(),
    content: @Composable () -> Unit
) {
    val colorScheme = if (darkTheme) SecureAiDarkColors else SecureAiLightColors

    MaterialTheme(
        colorScheme = colorScheme,
        content = content
    )
}
