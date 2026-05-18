package io.secureai.android.ui.auth

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.secureai.android.data.repository.AuthRepository
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asSharedFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import javax.inject.Inject

// ────────────────────────────────────────────
// UI 상태 정의
// ────────────────────────────────────────────

/** 인증 화면 UI 상태 — sealed interface로 상태 종류를 명확히 구분 */
sealed interface AuthUiState {
    data object Idle : AuthUiState
    data object Loading : AuthUiState
    data object Success : AuthUiState
    data class Error(val message: String) : AuthUiState
}

// ────────────────────────────────────────────
// ViewModel
// ────────────────────────────────────────────

/**
 * 로그인·회원가입 화면의 ViewModel.
 *
 * SRP: 인증 UI 상태 관리와 Repository 호출만 담당.
 * DIP: AuthRepository 인터페이스에 의존 (구현체 직접 참조 없음).
 *
 * 네비게이션 이벤트는 SharedFlow로 일회성 전달 — StateFlow와 구분.
 */
@HiltViewModel
class AuthViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow<AuthUiState>(AuthUiState.Idle)
    val uiState: StateFlow<AuthUiState> = _uiState.asStateFlow()

    // 일회성 네비게이션 이벤트 (화면 이동 후 재실행 방지)
    private val _navigationEvent = MutableSharedFlow<NavigationEvent>()
    val navigationEvent: SharedFlow<NavigationEvent> = _navigationEvent.asSharedFlow()

    /** 이미 로그인된 상태인지 확인 (NavGraph 시작 목적지 결정에 사용) */
    fun isLoggedIn(): Boolean = authRepository.isLoggedIn()

    /**
     * 이메일/패스워드로 로그인을 시도한다.
     * 성공 시 토큰 저장 후 Dashboard 네비게이션 이벤트를 발행한다.
     */
    fun login(email: String, password: String) {
        if (_uiState.value is AuthUiState.Loading) return
        _uiState.value = AuthUiState.Loading

        viewModelScope.launch {
            runCatching { authRepository.login(email, password) }
                .onSuccess {
                    _uiState.value = AuthUiState.Success
                    _navigationEvent.emit(NavigationEvent.ToDashboard)
                }
                .onFailure { throwable ->
                    _uiState.value = AuthUiState.Error(
                        throwable.message ?: "로그인에 실패했습니다."
                    )
                }
        }
    }

    /**
     * 신규 계정을 생성하고 로그인 상태로 전환한다.
     * 성공 시 토큰 저장 후 Dashboard 네비게이션 이벤트를 발행한다.
     */
    fun register(email: String, password: String, username: String) {
        if (_uiState.value is AuthUiState.Loading) return
        _uiState.value = AuthUiState.Loading

        viewModelScope.launch {
            runCatching { authRepository.register(email, password, username) }
                .onSuccess {
                    _uiState.value = AuthUiState.Success
                    _navigationEvent.emit(NavigationEvent.ToDashboard)
                }
                .onFailure { throwable ->
                    _uiState.value = AuthUiState.Error(
                        throwable.message ?: "회원가입에 실패했습니다."
                    )
                }
        }
    }

    /** 에러 메시지를 표시한 후 Idle로 초기화 */
    fun clearError() {
        _uiState.value = AuthUiState.Idle
    }
}

// ────────────────────────────────────────────
// 네비게이션 이벤트
// ────────────────────────────────────────────

sealed interface NavigationEvent {
    data object ToDashboard : NavigationEvent
    data object ToLogin : NavigationEvent
    data object ToRegister : NavigationEvent
}
