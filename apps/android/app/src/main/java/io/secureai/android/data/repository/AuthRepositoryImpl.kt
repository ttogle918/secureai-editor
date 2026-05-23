package io.secureai.android.data.repository

import io.secureai.android.data.local.TokenStorage
import io.secureai.android.data.remote.AuthApi
import io.secureai.android.data.remote.dto.LoginRequest
import io.secureai.android.data.remote.dto.RegisterRequest
import javax.inject.Inject
import javax.inject.Singleton

/**
 * AuthRepository 구현체.
 *
 * SRP: API 호출과 토큰 저장 두 단계만 담당한다.
 * 네트워크 오류는 호출자(ViewModel)에서 처리한다.
 */
@Singleton
class AuthRepositoryImpl @Inject constructor(
    private val authApi: AuthApi,
    private val tokenStorage: TokenStorage
) : AuthRepository {

    override suspend fun login(email: String, password: String) {
        val response = authApi.login(LoginRequest(email = email, password = password))
        tokenStorage.saveTokens(
            accessToken = response.accessToken,
            refreshToken = response.refreshToken
        )
    }

    override suspend fun register(email: String, password: String, username: String) {
        val response = authApi.register(
            RegisterRequest(email = email, password = password, username = username)
        )
        tokenStorage.saveTokens(
            accessToken = response.accessToken,
            refreshToken = response.refreshToken
        )
    }

    override fun logout() {
        tokenStorage.clear()
    }

    override fun isLoggedIn(): Boolean = tokenStorage.hasToken()
}
