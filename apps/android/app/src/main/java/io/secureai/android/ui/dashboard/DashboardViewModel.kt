package io.secureai.android.ui.dashboard

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.secureai.android.data.remote.model.DashboardResponse
import io.secureai.android.data.repository.AuthRepository
import io.secureai.android.data.repository.DashboardRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface DashboardUiState {
    object Loading : DashboardUiState
    data class Success(val data: DashboardResponse) : DashboardUiState
    data class Error(val message: String) : DashboardUiState
}

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val dashboardRepository: DashboardRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<DashboardUiState>(DashboardUiState.Loading)
    val uiState: StateFlow<DashboardUiState> = _uiState.asStateFlow()

    fun loadDashboard(projectId: String) {
        viewModelScope.launch {
            _uiState.value = DashboardUiState.Loading
            try {
                val data = dashboardRepository.getDashboard(projectId)
                _uiState.value = DashboardUiState.Success(data)
            } catch (e: Exception) {
                _uiState.value = DashboardUiState.Error(
                    e.message ?: "대시보드 데이터를 불러오지 못했습니다."
                )
            }
        }
    }

    fun logout() {
        authRepository.logout()
    }
}
