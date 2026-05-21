package io.secureai.android.ui.analysis

import android.content.Context
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import dagger.hilt.android.qualifiers.ApplicationContext
import io.secureai.android.BuildConfig
import io.secureai.android.sse.SseClient
import io.secureai.android.sse.SseResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * 분석 세션의 UI 상태를 나타내는 sealed interface.
 *
 * 설계 원칙:
 * - sealed interface로 완전한 상태 집합 표현 → when 분기 안전성 보장
 */
sealed interface AnalysisUiState {
    /** 분석 미시작 또는 초기화 상태 */
    data object Idle : AnalysisUiState

    /** SSE 스트림 구독 중 */
    data class Running(val sessionId: String) : AnalysisUiState

    /** 분석 완료 (SSE 또는 FCM 경유) */
    data class Completed(val sessionId: String, val projectId: String) : AnalysisUiState

    /** SSE 연결 오류 */
    data class Error(val message: String) : AnalysisUiState
}

/**
 * 분석 세션 상태를 관리하는 ViewModel.
 *
 * 이중 전략:
 * - Foreground: [startSseObservation]으로 SSE 구독 → 완료 시 [AnalysisUiState.Completed]
 * - Background/종료 후 딥링크 진입: [onFcmCompleted]로 즉시 완료 상태 전이
 *
 * 설계 원칙:
 * - SRP: SSE 구독 및 상태 노출만 담당 (알림 표시는 SecureAiFcmService 담당)
 * - SSE 구독 취소는 viewModelScope 소멸 시 자동 처리
 */
private val UUID_PATTERN = Regex("[0-9a-f\\-]{36}")

@HiltViewModel
class AnalysisViewModel @Inject constructor(
    private val sseClient: SseClient,
    @ApplicationContext private val context: Context
) : ViewModel() {

    private val _uiState = MutableStateFlow<AnalysisUiState>(AnalysisUiState.Idle)
    val uiState: StateFlow<AnalysisUiState> = _uiState.asStateFlow()

    /**
     * SSE 스트림 구독을 시작한다.
     * 이미 [AnalysisUiState.Running] 또는 [AnalysisUiState.Completed] 상태이면 중복 구독하지 않는다.
     *
     * 보안: sessionId를 URL에 삽입하기 전 UUID 형식([0-9a-f-]{36}) 검증 — 경로 삽입 방지
     */
    fun startSseObservation(
        sessionId: String,
        projectId: String,
        baseUrl: String = BuildConfig.API_BASE_URL
    ) {
        if (!UUID_PATTERN.matches(sessionId)) {
            _uiState.value = AnalysisUiState.Error("유효하지 않은 세션 ID 형식")
            return
        }
        val current = _uiState.value
        if (current is AnalysisUiState.Running || current is AnalysisUiState.Completed) return

        _uiState.value = AnalysisUiState.Running(sessionId)

        viewModelScope.launch {
            sseClient.observeSession(sessionId, baseUrl)
                .catch { e ->
                    _uiState.value = AnalysisUiState.Error(e.message ?: "SSE 연결 오류")
                }
                .collect { result ->
                    when (result) {
                        is SseResult.SessionCompleted ->
                            _uiState.value = AnalysisUiState.Completed(sessionId, projectId)

                        is SseResult.Closed -> {
                            // 정상 종료 — Running 상태인 경우에만 Idle로 복귀 (Completed면 유지)
                            if (_uiState.value is AnalysisUiState.Running) {
                                _uiState.value = AnalysisUiState.Idle
                            }
                        }

                        else -> { /* 일반 이벤트는 무시 */ }
                    }
                }
        }
    }

    /**
     * FCM background 알림 클릭으로 앱 진입 시 완료 상태를 설정한다.
     * SSE 없이 즉시 [AnalysisUiState.Completed]로 전이한다.
     */
    fun onFcmCompleted(sessionId: String, projectId: String) {
        _uiState.value = AnalysisUiState.Completed(sessionId, projectId)
    }

    /** 상태를 [AnalysisUiState.Idle]로 초기화한다 */
    fun reset() {
        _uiState.value = AnalysisUiState.Idle
    }
}
