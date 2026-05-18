package io.secureai.android

import app.cash.turbine.test
import io.mockk.every
import io.mockk.mockk
import io.secureai.android.sse.SseClient
import io.secureai.android.sse.SseResult
import io.secureai.android.ui.analysis.AnalysisUiState
import io.secureai.android.ui.analysis.AnalysisViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.flow.flowOf
import kotlinx.coroutines.flow.flow
import kotlinx.coroutines.test.StandardTestDispatcher
import kotlinx.coroutines.test.advanceUntilIdle
import kotlinx.coroutines.test.resetMain
import kotlinx.coroutines.test.runTest
import kotlinx.coroutines.test.setMain
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * AnalysisViewModel 단위 테스트.
 *
 * 테스트 전략:
 * - MockK로 SseClient를 가짜로 교체 — DIP 덕분에 가능
 * - Turbine으로 StateFlow 이벤트 검증
 * - Coroutines Test Dispatcher로 비동기 흐름 제어
 */
@OptIn(ExperimentalCoroutinesApi::class)
class AnalysisViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var sseClient: SseClient
    private lateinit var viewModel: AnalysisViewModel

    companion object {
        private const val SESSION_ID = "550e8400-e29b-41d4-a716-446655440000"
        private const val PROJECT_ID = "proj-123"
        private const val BASE_URL = "http://localhost:8080/"
    }

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        sseClient = mockk(relaxed = true)
        // Context는 ViewModel에서 BuildConfig.API_BASE_URL 접근용으로만 쓰이므로 mockk
        val context = mockk<android.content.Context>(relaxed = true)
        viewModel = AnalysisViewModel(sseClient, context)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    // ────────────────────────────────────────────
    // startSseObservation() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `startSseObservation 호출 시 Running 상태로 전이된다`() = runTest {
        every { sseClient.observeSession(any(), any()) } returns flowOf()

        viewModel.uiState.test {
            assertEquals(AnalysisUiState.Idle, awaitItem())

            viewModel.startSseObservation(SESSION_ID, PROJECT_ID, BASE_URL)
            advanceUntilIdle()

            val state = awaitItem()
            assertTrue("Running을 기대하지만 $state 수신", state is AnalysisUiState.Running)
            assertEquals(SESSION_ID, (state as AnalysisUiState.Running).sessionId)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `session_completed SSE 이벤트 수신 시 Completed 상태로 전이된다`() = runTest {
        every { sseClient.observeSession(SESSION_ID, BASE_URL) } returns flowOf(
            SseResult.SessionCompleted(SESSION_ID)
        )

        viewModel.uiState.test {
            assertEquals(AnalysisUiState.Idle, awaitItem())

            viewModel.startSseObservation(SESSION_ID, PROJECT_ID, BASE_URL)
            advanceUntilIdle()

            // Running 상태
            val running = awaitItem()
            assertTrue(running is AnalysisUiState.Running)

            // Completed 상태
            val completed = awaitItem()
            assertTrue("Completed를 기대하지만 $completed 수신", completed is AnalysisUiState.Completed)
            assertEquals(SESSION_ID, (completed as AnalysisUiState.Completed).sessionId)
            assertEquals(PROJECT_ID, completed.projectId)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `SSE Closed 수신 시 Running 상태이면 Idle로 복귀한다`() = runTest {
        every { sseClient.observeSession(SESSION_ID, BASE_URL) } returns flowOf(
            SseResult.Closed
        )

        viewModel.uiState.test {
            assertEquals(AnalysisUiState.Idle, awaitItem())

            viewModel.startSseObservation(SESSION_ID, PROJECT_ID, BASE_URL)
            advanceUntilIdle()

            val running = awaitItem()
            assertTrue(running is AnalysisUiState.Running)

            val idle = awaitItem()
            assertEquals(AnalysisUiState.Idle, idle)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `SSE 오류 발생 시 Error 상태로 전이된다`() = runTest {
        val errorMessage = "연결 실패"
        every { sseClient.observeSession(SESSION_ID, BASE_URL) } returns flow {
            throw RuntimeException(errorMessage)
        }

        viewModel.uiState.test {
            assertEquals(AnalysisUiState.Idle, awaitItem())

            viewModel.startSseObservation(SESSION_ID, PROJECT_ID, BASE_URL)
            advanceUntilIdle()

            val running = awaitItem()
            assertTrue(running is AnalysisUiState.Running)

            val error = awaitItem()
            assertTrue("Error를 기대하지만 $error 수신", error is AnalysisUiState.Error)
            assertEquals(errorMessage, (error as AnalysisUiState.Error).message)

            cancelAndIgnoreRemainingEvents()
        }
    }

    // ────────────────────────────────────────────
    // onFcmCompleted() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `onFcmCompleted 호출 시 Completed 상태로 즉시 전이된다`() = runTest {
        viewModel.uiState.test {
            assertEquals(AnalysisUiState.Idle, awaitItem())

            viewModel.onFcmCompleted(SESSION_ID, PROJECT_ID)

            val completed = awaitItem()
            assertTrue("Completed를 기대하지만 $completed 수신", completed is AnalysisUiState.Completed)
            assertEquals(SESSION_ID, (completed as AnalysisUiState.Completed).sessionId)
            assertEquals(PROJECT_ID, completed.projectId)

            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `onFcmCompleted는 SSE 구독 없이도 즉시 동작한다`() = runTest {
        // SSE 구독 없이 직접 FCM 완료 이벤트 처리
        viewModel.onFcmCompleted(SESSION_ID, PROJECT_ID)

        val state = viewModel.uiState.value
        assertTrue("Completed를 기대하지만 $state 수신", state is AnalysisUiState.Completed)
    }

    // ────────────────────────────────────────────
    // reset() 테스트
    // ────────────────────────────────────────────

    @Test
    fun `reset 호출 시 Idle 상태로 초기화된다`() = runTest {
        viewModel.onFcmCompleted(SESSION_ID, PROJECT_ID)
        assertTrue(viewModel.uiState.value is AnalysisUiState.Completed)

        viewModel.reset()

        assertEquals(AnalysisUiState.Idle, viewModel.uiState.value)
    }

    // ────────────────────────────────────────────
    // 중복 구독 방지 테스트
    // ────────────────────────────────────────────

    @Test
    fun `Running 상태에서 startSseObservation 재호출 시 중복 구독하지 않는다`() = runTest {
        every { sseClient.observeSession(any(), any()) } returns flowOf()

        viewModel.startSseObservation(SESSION_ID, PROJECT_ID, BASE_URL)
        advanceUntilIdle()

        assertTrue(viewModel.uiState.value is AnalysisUiState.Running)

        // 두 번째 호출은 무시되어야 함
        viewModel.startSseObservation(SESSION_ID, PROJECT_ID, BASE_URL)
        advanceUntilIdle()

        // 상태는 여전히 Running
        assertTrue(viewModel.uiState.value is AnalysisUiState.Running)
    }
}
