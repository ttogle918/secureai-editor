package io.secureai.android.data.remote

import io.secureai.android.data.remote.dto.AuthResponse
import io.secureai.android.data.remote.dto.LoginRequest
import io.secureai.android.data.remote.dto.RegisterRequest
import retrofit2.http.Body
import retrofit2.http.POST

/**
 * 백엔드 인증 엔드포인트 Retrofit 인터페이스.
 *
 * 실제 엔드포인트:
 *   POST /api/v1/auth/login    — 이메일/패스워드 로그인
 *   POST /api/v1/auth/register — 신규 회원 가입
 */
interface AuthApi {

    @POST("api/v1/auth/login")
    suspend fun login(@Body request: LoginRequest): AuthResponse

    @POST("api/v1/auth/register")
    suspend fun register(@Body request: RegisterRequest): AuthResponse
}
