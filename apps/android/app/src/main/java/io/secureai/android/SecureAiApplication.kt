package io.secureai.android

import android.app.Application
import android.os.Build
import dagger.hilt.android.HiltAndroidApp
import io.secureai.android.notification.NotificationChannelConfig

/**
 * Hilt DI 컨테이너 진입점.
 * @HiltAndroidApp 어노테이션이 Hilt 코드 생성을 트리거한다.
 * AndroidManifest.xml의 android:name=".SecureAiApplication"으로 연결된다.
 */
@HiltAndroidApp
class SecureAiApplication : Application() {

    override fun onCreate() {
        super.onCreate()
        registerNotificationChannels()
    }

    /**
     * Android 8.0(Oreo, API 26)+에서 필수인 알림 채널을 앱 시작 시 등록한다.
     * NotificationChannelConfig에 채널 정의가 집중되어 있어 여기서는 호출만 한다.
     */
    private fun registerNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannelConfig.createAll(this)
        }
    }
}
