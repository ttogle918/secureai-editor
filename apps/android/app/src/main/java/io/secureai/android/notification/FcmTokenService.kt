package io.secureai.android.notification

import android.util.Log
import io.secureai.android.data.local.TokenStorage
import io.secureai.android.data.remote.api.DeviceTokenRequest
import io.secureai.android.data.remote.api.FcmTokenApi
import javax.inject.Inject

private const val TAG = "FcmTokenService"

/**
 * FCM 디바이스 토큰을 백엔드에 등록하는 서비스.
 *
 * 설계 원칙:
 * - SRP: 토큰 등록 책임만 담당
 * - 로그인 상태가 아니면 등록을 건너뜀 — 로그인 이후 토큰 갱신 시 재등록됨
 *
 * 보안 규칙:
 * - FCM 토큰을 로그에 절대 출력 금지
 * - 등록 실패는 치명적이지 않으므로 예외를 삼키고 로그만 기록
 */
class FcmTokenService @Inject constructor(
    private val fcmTokenApi: FcmTokenApi,
    private val tokenStorage: TokenStorage
) {
    /**
     * FCM 토큰을 백엔드에 등록한다.
     * 로그인 상태(Access Token 존재)가 아니면 등록을 미룬다.
     */
    suspend fun registerToken(fcmToken: String) {
        if (tokenStorage.getAccessToken() == null) {
            // 비로그인 상태 — 로그인 후 onNewToken 재호출 시 등록됨
            Log.d(TAG, "Not logged in, FCM token registration deferred")
            return
        }
        try {
            fcmTokenApi.registerDeviceToken(DeviceTokenRequest(fcmToken))
            Log.d(TAG, "FCM device token registered successfully")
        } catch (e: Exception) {
            // 토큰 등록 실패는 치명적이지 않음 — 다음 토큰 갱신 시 재시도됨
            Log.w(TAG, "FCM device token registration failed: ${e.message}")
        }
    }
}
