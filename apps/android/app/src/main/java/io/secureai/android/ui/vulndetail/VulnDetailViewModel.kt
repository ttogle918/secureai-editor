package io.secureai.android.ui.vulndetail

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.secureai.android.data.remote.model.VulnerabilityDto
import io.secureai.android.data.repository.VulnRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface VulnDetailUiState {
    object Loading : VulnDetailUiState
    data class Success(val vuln: VulnerabilityDto) : VulnDetailUiState
    data class Error(val message: String) : VulnDetailUiState
}

@HiltViewModel
class VulnDetailViewModel @Inject constructor(
    private val vulnRepository: VulnRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<VulnDetailUiState>(VulnDetailUiState.Loading)
    val uiState: StateFlow<VulnDetailUiState> = _uiState.asStateFlow()

    fun loadDetail(projectId: String, vulnId: String) {
        viewModelScope.launch {
            _uiState.value = VulnDetailUiState.Loading
            try {
                val vuln = vulnRepository.getVulnerabilityDetail(projectId, vulnId)
                _uiState.value = VulnDetailUiState.Success(vuln)
            } catch (e: Exception) {
                _uiState.value = VulnDetailUiState.Error(
                    e.message ?: "취약점 상세 정보를 불러오지 못했습니다."
                )
            }
        }
    }
}
