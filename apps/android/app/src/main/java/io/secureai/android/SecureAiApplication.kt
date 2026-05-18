package io.secureai.android

import android.app.Application
import dagger.hilt.android.HiltAndroidApp

/**
 * Hilt DI 컨테이너 진입점.
 * @HiltAndroidApp 어노테이션이 Hilt 코드 생성을 트리거한다.
 * AndroidManifest.xml의 android:name=".SecureAiApplication"으로 연결된다.
 */
@HiltAndroidApp
class SecureAiApplication : Application()
