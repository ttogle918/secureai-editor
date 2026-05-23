package io.secureai.android

import io.mockk.coEvery
import io.mockk.mockk
import io.secureai.android.data.remote.model.DashboardResponse
import io.secureai.android.data.remote.model.FileHeatPoint
import io.secureai.android.data.remote.model.SeverityCounts
import io.secureai.android.data.remote.model.TrendPoint
import io.secureai.android.data.repository.AuthRepository
import io.secureai.android.data.repository.DashboardRepository
import io.secureai.android.ui.dashboard.DashboardUiState
import io.secureai.android.ui.dashboard.DashboardViewModel
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.ExperimentalCoroutinesApi
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
 * DashboardViewModel 단위 테스트.
 *
 * MockK로 DashboardRepository를 가짜로 교체하고,
 * loadDashboard() 호출 결과로 UiState가 올바르게 전환되는지 검증한다.
 */
@OptIn(ExperimentalCoroutinesApi::class)
class DashboardViewModelTest {

    private val testDispatcher = StandardTestDispatcher()
    private lateinit var dashboardRepository: DashboardRepository
    private lateinit var authRepository: AuthRepository
    private lateinit var viewModel: DashboardViewModel

    private val fakeDashboard = DashboardResponse(
        securityScore = 75,
        severityCounts = SeverityCounts(
            CRITICAL = 1, HIGH = 3, MEDIUM = 5, LOW = 10, INFO = 2
        ),
        trend = listOf(TrendPoint(date = "2026-05-01", count = 10)),
        fileHeatmap = listOf(FileHeatPoint(filePath = "src/main/Example.kt", count = 3)),
        owaspCoverage = mapOf("A01" to true, "A02" to false)
    )

    @Before
    fun setUp() {
        Dispatchers.setMain(testDispatcher)
        dashboardRepository = mockk()
        authRepository = mockk(relaxed = true)
        viewModel = DashboardViewModel(authRepository, dashboardRepository)
    }

    @After
    fun tearDown() {
        Dispatchers.resetMain()
    }

    @Test
    fun `loadDashboard 성공 시 UiState가 Success로 변경된다`() = runTest {
        coEvery { dashboardRepository.getDashboard(any()) } returns fakeDashboard

        viewModel.loadDashboard("project-123")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is DashboardUiState.Success)
        assertEquals(fakeDashboard, (state as DashboardUiState.Success).data)
    }

    @Test
    fun `loadDashboard 실패 시 UiState가 Error로 변경된다`() = runTest {
        val errorMessage = "네트워크 오류"
        coEvery { dashboardRepository.getDashboard(any()) } throws RuntimeException(errorMessage)

        viewModel.loadDashboard("project-123")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is DashboardUiState.Error)
        assertEquals(errorMessage, (state as DashboardUiState.Error).message)
    }

    @Test
    fun `loadDashboard 호출 직후 UiState가 Loading이다`() = runTest {
        coEvery { dashboardRepository.getDashboard(any()) } returns fakeDashboard

        viewModel.loadDashboard("project-123")

        // advanceUntilIdle 이전 — Loading 상태 확인
        assertTrue(viewModel.uiState.value is DashboardUiState.Loading)
    }

    @Test
    fun `loadDashboard 실패 시 message가 빈 경우 기본 메시지를 사용한다`() = runTest {
        coEvery { dashboardRepository.getDashboard(any()) } throws RuntimeException()

        viewModel.loadDashboard("project-123")
        advanceUntilIdle()

        val state = viewModel.uiState.value
        assertTrue(state is DashboardUiState.Error)
        assertEquals("대시보드 데이터를 불러오지 못했습니다.", (state as DashboardUiState.Error).message)
    }
}
