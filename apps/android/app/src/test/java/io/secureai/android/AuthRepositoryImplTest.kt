package io.secureai.android

import io.mockk.Runs
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.just
import io.mockk.mockk
import io.mockk.verify
import io.secureai.android.data.local.TokenStorage
import io.secureai.android.data.remote.AuthApi
import io.secureai.android.data.remote.dto.AuthResponse
import io.secureai.android.data.remote.dto.LoginRequest
import io.secureai.android.data.remote.dto.RegisterRequest
import io.secureai.android.data.repository.AuthRepositoryImpl
import kotlinx.coroutines.test.runTest
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * AuthRepositoryImpl 단위 테스트.
 *
 * AuthApi, TokenStorage를 MockK로 모킹하여
 * Repository가 API 호출 결과를 올바르게 TokenStorage에 저장하는지 검증한다.
 */
class AuthRepositoryImplTest {

    private lateinit var authApi: AuthApi
    private lateinit var tokenStorage: TokenStorage
    private lateinit var repository: AuthRepositoryImpl

    private val fakeAuthResponse = AuthResponse(
        accessToken = "fake_access_token",
        refreshToken = "fake_refresh_token",
        userId = 42L
    )

    @Before
    fun setUp() {
        authApi = mockk()
        tokenStorage = mockk(relaxed = true)
        repository = AuthRepositoryImpl(authApi, tokenStorage)
    }

    // ────────────────────────────────────────────
    // login() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `login 성공 시 API 응답의 토큰이 TokenStorage에 저장된다`() = runTest {
        coEvery { authApi.login(any()) } returns fakeAuthResponse

        repository.login("test@example.com", "password123")

        verify {
            tokenStorage.saveTokens(
                accessToken = "fake_access_token",
                refreshToken = "fake_refresh_token"
            )
        }
    }

    @Test
    fun `login 시 올바른 요청 DTO가 API에 전달된다`() = runTest {
        coEvery { authApi.login(any()) } returns fakeAuthResponse

        repository.login("user@example.com", "mypassword")

        coVerify {
            authApi.login(LoginRequest(email = "user@example.com", password = "mypassword"))
        }
    }

    @Test(expected = RuntimeException::class)
    fun `login API 호출 실패 시 예외가 전파된다`() = runTest {
        coEvery { authApi.login(any()) } throws RuntimeException("Network error")

        repository.login("test@example.com", "password")
        // 예외가 전파되므로 TokenStorage.saveTokens는 호출되지 않아야 함
    }

    // ────────────────────────────────────────────
    // register() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `register 성공 시 API 응답의 토큰이 TokenStorage에 저장된다`() = runTest {
        coEvery { authApi.register(any()) } returns fakeAuthResponse

        repository.register("new@example.com", "password123", "newuser")

        verify {
            tokenStorage.saveTokens(
                accessToken = "fake_access_token",
                refreshToken = "fake_refresh_token"
            )
        }
    }

    @Test
    fun `register 시 올바른 요청 DTO가 API에 전달된다`() = runTest {
        coEvery { authApi.register(any()) } returns fakeAuthResponse

        repository.register("new@example.com", "password", "username")

        coVerify {
            authApi.register(
                RegisterRequest(
                    email = "new@example.com",
                    password = "password",
                    username = "username"
                )
            )
        }
    }

    // ────────────────────────────────────────────
    // logout() / isLoggedIn() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `logout 호출 시 TokenStorage의 clear가 호출된다`() {
        repository.logout()

        verify { tokenStorage.clear() }
    }

    @Test
    fun `isLoggedIn은 TokenStorage의 hasToken 결과를 반환한다`() {
        every { tokenStorage.hasToken() } returns true
        assertTrue(repository.isLoggedIn())

        every { tokenStorage.hasToken() } returns false
        assertFalse(repository.isLoggedIn())
    }
}
