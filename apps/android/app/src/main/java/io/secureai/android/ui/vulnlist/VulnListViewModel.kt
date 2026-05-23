package io.secureai.android.ui.vulnlist

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.secureai.android.data.local.entity.VulnerabilityEntity
import io.secureai.android.data.repository.VulnRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

sealed interface VulnListUiState {
    object Loading : VulnListUiState
    data class Success(val vulnerabilities: List<VulnerabilityEntity>) : VulnListUiState
    data class Error(val message: String) : VulnListUiState
}

@HiltViewModel
class VulnListViewModel @Inject constructor(
    private val vulnRepository: VulnRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<VulnListUiState>(VulnListUiState.Loading)
    val uiState: StateFlow<VulnListUiState> = _uiState.asStateFlow()

    fun loadVulnerabilities(projectId: String) {
        viewModelScope.launch {
            vulnRepository.getVulnerabilities(projectId)
                .catch { e ->
                    _uiState.value = VulnListUiState.Error(
                        e.message ?: "취약점 목록을 불러오지 못했습니다."
                    )
                }
                .collect { list ->
                    _uiState.value = VulnListUiState.Success(list)
                }
        }
    }
}
