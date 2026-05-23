package io.secureai.android.data.remote.api

import retrofit2.http.Body
import retrofit2.http.POST

/**
 * FCM 디바이스 토큰을 백엔드에 등록하는 API.
 *
 * 보안 규칙:
 * - 토큰 값은 로그에 절대 출력 금지 (FcmTokenService에서도 동일 적용)
 */
data class DeviceTokenRequest(val token: String)

interface FcmTokenApi {
    @POST("api/v1/fcm/device-tokens")
    suspend fun registerDeviceToken(@Body body: DeviceTokenRequest)
}
