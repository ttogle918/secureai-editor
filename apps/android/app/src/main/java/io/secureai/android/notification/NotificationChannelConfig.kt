package io.secureai.android.notification

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.media.AudioAttributes
import android.media.RingtoneManager
import android.os.Build
import androidx.annotation.RequiresApi

/**
 * 앱에서 사용하는 알림 채널 ID 상수 및 채널 등록 로직을 한 곳에 모아둔다.
 *
 * 설계 원칙:
 * - SRP: 채널 ID 정의와 채널 생성만 담당
 * - 채널이 이미 존재하면 createNotificationChannels()는 무시되므로 중복 호출 안전
 */
object NotificationChannelConfig {

    const val CHANNEL_ANALYSIS_COMPLETION = "analysis_completion"
    const val CHANNEL_VULNERABILITY_CRITICAL = "vulnerability_critical"
    const val CHANNEL_MONITORING_ALERT = "monitoring_alert"

    /**
     * 3개의 알림 채널을 한 번에 등록한다.
     * Android 8.0(Oreo, API 26)+ 전용이므로 @RequiresApi로 명시한다.
     * 호출 측은 Build.VERSION.SDK_INT >= Build.VERSION_CODES.O 조건부로 호출해야 한다.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    fun createAll(context: Context) {
        val manager = context.getSystemService(NotificationManager::class.java)
        manager.createNotificationChannels(
            listOf(
                analysisCompletionChannel(),
                vulnerabilityCriticalChannel(),
                monitoringAlertChannel()
            )
        )
    }

    /**
     * 분석 완료 채널 — 기본 알림음, IMPORTANCE_HIGH.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun analysisCompletionChannel(): NotificationChannel =
        NotificationChannel(
            CHANNEL_ANALYSIS_COMPLETION,
            "분석 완료",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "보안 분석 완료 알림"
        }

    /**
     * 취약점 위험 채널 — 긴급 알림음(TYPE_ALARM), IMPORTANCE_HIGH.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun vulnerabilityCriticalChannel(): NotificationChannel =
        NotificationChannel(
            CHANNEL_VULNERABILITY_CRITICAL,
            "취약점 위험 알림",
            NotificationManager.IMPORTANCE_HIGH
        ).apply {
            description = "심각도 높은 취약점 발견 시 즉시 알림"
            val alarmUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_ALARM)
            val audioAttributes = AudioAttributes.Builder()
                .setUsage(AudioAttributes.USAGE_ALARM)
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .build()
            setSound(alarmUri, audioAttributes)
        }

    /**
     * 모니터링 경보 채널 — 진동만, IMPORTANCE_DEFAULT.
     */
    @RequiresApi(Build.VERSION_CODES.O)
    private fun monitoringAlertChannel(): NotificationChannel =
        NotificationChannel(
            CHANNEL_MONITORING_ALERT,
            "모니터링 경보",
            NotificationManager.IMPORTANCE_DEFAULT
        ).apply {
            description = "지속적 모니터링 중 이상 감지 알림"
            // 알림음 없이 진동만
            setSound(null, null)
            enableVibration(true)
        }
}
