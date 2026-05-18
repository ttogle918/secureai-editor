package io.secureai.android

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import dagger.hilt.android.HiltAndroidApp

private const val CHANNEL_ID_ANALYSIS = "analysis_complete"

/**
 * Hilt DI 컨테이너 진입점.
 * @HiltAndroidApp 어노테이션이 Hilt 코드 생성을 트리거한다.
 * AndroidManifest.xml의 android:name=".SecureAiApplication"으로 연결된다.
 */
@HiltAndroidApp
class SecureAiApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
    }

    /**
     * Android 8.0(Oreo, API 26)+에서 필수인 알림 채널을 앱 시작 시 등록한다.
     * 채널이 이미 존재하면 createNotificationChannel()은 무시되므로 중복 호출 안전.
     */
    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID_ANALYSIS,
                "분석 완료",
                NotificationManager.IMPORTANCE_HIGH
            ).apply {
                description = "보안 분석 완료 알림"
            }
            val notificationManager = getSystemService(NotificationManager::class.java)
            notificationManager.createNotificationChannel(channel)
        }
    }
}
