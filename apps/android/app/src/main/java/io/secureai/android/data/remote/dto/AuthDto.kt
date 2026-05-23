package io.secureai.android.data.remote.dto

import com.google.gson.annotations.SerializedName

// ────────────────────────────────────────────
// 요청 DTO
// ────────────────────────────────────────────

data class LoginRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String
)

data class RegisterRequest(
    @SerializedName("email") val email: String,
    @SerializedName("password") val password: String,
    @SerializedName("username") val username: String
)

// ────────────────────────────────────────────
// 응답 DTO
// ────────────────────────────────────────────

/**
 * 백엔드 `/api/v1/auth/login`, `/api/v1/auth/register` 공통 응답.
 * userId는 대시보드 초기 로드에 사용된다.
 */
data class AuthResponse(
    @SerializedName("accessToken") val accessToken: String,
    @SerializedName("refreshToken") val refreshToken: String,
    @SerializedName("userId") val userId: Long
)

/**
 * 백엔드 공통 에러 응답 형식.
 * Retrofit 에러 바디 파싱에 사용된다.
 */
data class ErrorResponse(
    @SerializedName("code") val code: String?,
    @SerializedName("message") val message: String?
)
