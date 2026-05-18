package io.secureai.android

import app.cash.turbine.test
import io.mockk.coEvery
import io.mockk.coVerify
import io.mockk.every
import io.mockk.mockk
import io.secureai.android.data.repository.AuthRepository
import io.secureai.android.ui.auth.AuthUiState
import io.secureai.android.ui.auth.AuthViewModel
import io.secureai.android.ui.auth.NavigationEvent
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * AuthViewModel 단위 테스트.
 *
 * 테스트 전략:
 * - MockK로 AuthRepository를 가짜(Fake)로 교체 — DIP 덕분에 가능
 * - Turbine으로 StateFlow/SharedFlow 이벤트를 검증
 * - Coroutines Test Dispatcher로 비동기 흐름 제어
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AuthViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var authRepository: AuthRepository
    private lateinit var viewModel: AuthViewModel

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        authRepository = mockk(relaxed = true)
        viewModel = AuthViewModel(authRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ────────────────────────────────────────────
    // login() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `login 성공 시 uiState가 Success로 변경된다`() = runTest {
        coEvery { authRepository.login(any(), any()) } returns Unit

        viewModel.login("test@example.com", "password123")
        advanceUntilIdle()

        assertEquals(AuthUiState.Success, viewModel.uiState.value)
    }

    @Test
    fun `login 성공 시 ToDashboard 네비게이션 이벤트가 발행된다`() = runTest {
        coEvery { authRepository.login(any(), any()) } returns Unit

        viewModel.navigationEvent.test {
            viewModel.login("test@example.com", "password123")
            advanceUntilIdle()

            val event = awaitItem()
            assertEquals(NavigationEvent.ToDashboard, event)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `login 실패 시 uiState가 Error로 변경된다`() = runTest {
        val errorMessage = "이메일 또는 패스워드가 올바르지 않습니다."
        coEvery { authRepository.login(any(), any()) } throws RuntimeException(errorMessage)

        viewModel.login("test@example.com", "wrongpassword")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is AuthUiState.Error)
        assertEquals(errorMessage, (state as AuthUiState.Error).message)
    }

    @Test
    fun `login 중복 호출 시 Loading 상태에서는 두 번째 호출이 무시된다`() = runTest {
        // 첫 번째 호출이 진행 중인 동안 두 번째 호출
        coEvery { authRepository.login(any(), any()) } coAnswers {
            kotlinx.coroutines.delay(1000L)
        }

        viewModel.login("test@example.com", "password")
        // advanceUntilIdle 전 — Loading 상태
        viewModel.login("test@example.com", "password") // 무시되어야 함

        advanceUntilIdle()

        // repository.login은 정확히 1번만 호출되어야 함
        coVerify(exactly = 1) { authRepository.login(any(), any()) }
    }

    // ────────────────────────────────────────────
    // register() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `register 성공 시 uiState가 Success로 변경된다`() = runTest {
        coEvery { authRepository.register(any(), any(), any()) } returns Unit

        viewModel.register("test@example.com", "password123", "testuser")
        advanceUntilIdle()

        assertEquals(AuthUiState.Success, viewModel.uiState.value)
    }

    @Test
    fun `register 실패 시 uiState가 Error로 변경된다`() = runTest {
        val errorMessage = "이미 사용 중인 이메일입니다."
        coEvery { authRepository.register(any(), any(), any()) } throws RuntimeException(errorMessage)

        viewModel.register("exists@example.com", "password123", "user")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is AuthUiState.Error)
        assertEquals(errorMessage, (state as AuthUiState.Error).message)
    }

    // ────────────────────────────────────────────
    // isLoggedIn() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `isLoggedIn은 repository의 반환값을 그대로 전달한다`() {
        every { authRepository.isLoggedIn() } returns true
        assertTrue(viewModel.isLoggedIn())

        every { authRepository.isLoggedIn() } returns false
        assertFalse(viewModel.isLoggedIn())
    }

    // ────────────────────────────────────────────
    // clearError() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `clearError 호출 시 uiState가 Idle로 초기화된다`() = runTest {
        coEvery { authRepository.login(any(), any()) } throws RuntimeException("오류")

        viewModel.login("test@example.com", "pass")
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is AuthUiState.Error)

        viewModel.clearError()

        assertEquals(AuthUiState.Idle, viewModel.uiState.value)
    }
}
