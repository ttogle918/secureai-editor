package io.secureai.android.ui.chat

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import dagger.hilt.android.lifecycle.HiltViewModel
import io.secureai.android.BuildConfig
import io.secureai.android.sse.SseClient
import io.secureai.android.sse.SseResult
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.catch
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * AI 채팅 한 건의 메시지를 나타낸다.
 *
 * @param content    메시지 텍스트 (스트리밍 중에는 점진적으로 누적됨)
 * @param isFromUser true이면 사용자 메시지, false이면 AI 응답 메시지
 */
data class ChatMessage(val content: String, val isFromUser: Boolean)

/**
 * 채팅 화면의 UI 상태를 나타내는 sealed interface.
 *
 * 설계 원칙:
 * - sealed interface로 완전한 상태 집합 표현 → when 분기 안전성 보장
 */
sealed interface ChatUiState {
    /** 채팅 미시작 또는 초기화 상태 */
    data object Idle : ChatUiState

    /** SSE 스트림에서 AI 응답을 수신 중 */
    data object Streaming : ChatUiState

    /** 스트리밍 완료 (session.completed 수신) */
    data object Completed : ChatUiState

    /** SSE 연결 오류 */
    data class Error(val message: String) : ChatUiState
}

/**
 * AI 채팅 스트리밍 화면 ViewModel.
 *
 * 설계 원칙:
 * - SRP: SSE 수집 및 메시지 상태 노출만 담당
 * - DIP: SseClient 인터페이스에 의존 (Hilt 주입)
 * - SSE 구독 취소는 viewModelScope 소멸 시 자동 처리
 *
 * 보안 규칙:
 * - sessionId는 URL에 삽입되기 전 UUID 형식 검증 → SseClient 내부 URL 구성 시 안전
 */
private val UUID_PATTERN = Regex("[0-9a-f\\-]{36}")

@HiltViewModel
class ChatViewModel @Inject constructor(
    private val sseClient: SseClient
) : ViewModel() {

    private val _messages = MutableStateFlow<List<ChatMessage>>(emptyList())
    val messages: StateFlow<List<ChatMessage>> = _messages.asStateFlow()

    private val _uiState = MutableStateFlow<ChatUiState>(ChatUiState.Idle)
    val uiState: StateFlow<ChatUiState> = _uiState.asStateFlow()

    /**
     * 사용자 메시지를 목록에 추가한다.
     * 실제 전송은 백엔드 REST API 호출이며, 현재는 UI 상에만 반영한다.
     */
    fun addUserMessage(content: String) {
        if (content.isBlank()) return
        _messages.update { it + ChatMessage(content = content, isFromUser = true) }
    }

    /**
     * 주어진 sessionId의 SSE 스트림을 구독하여 AI 응답을 실시간으로 수신한다.
     *
     * 동작:
     * - [SseResult.Event]: AI 응답 메시지에 텍스트를 점진적으로 append
     * - [SseResult.SessionCompleted]: 스트리밍 완료 상태로 전이
     * - [SseResult.Closed]: 스트리밍 중이었으면 Idle로 복귀 (정상 종료)
     *
     * 보안: sessionId를 URL에 삽입하기 전 UUID 형식 검증 (경로 삽입 방지)
     */
    fun startChat(
        sessionId: String,
        baseUrl: String = BuildConfig.API_BASE_URL
    ) {
        if (!UUID_PATTERN.matches(sessionId)) {
            _uiState.value = ChatUiState.Error("유효하지 않은 세션 ID 형식")
            return
        }

        if (_uiState.value is ChatUiState.Streaming) return

        // AI 응답을 받기 위한 빈 메시지 슬롯을 미리 추가
        _messages.update { it + ChatMessage(content = "", isFromUser = false) }
        _uiState.value = ChatUiState.Streaming

        viewModelScope.launch {
            sseClient.observeSession(sessionId, baseUrl)
                .catch { e ->
                    _uiState.value = ChatUiState.Error(e.message ?: "SSE 연결 오류")
                }
                .collect { result ->
                    when (result) {
                        is SseResult.Event -> appendToLastAiMessage(result.event.data)

                        is SseResult.SessionCompleted -> {
                            _uiState.value = ChatUiState.Completed
                        }

                        is SseResult.Closed -> {
                            // 정상 종료 — Streaming 상태인 경우에만 Idle로 복귀
                            if (_uiState.value is ChatUiState.Streaming) {
                                _uiState.value = ChatUiState.Idle
                            }
                        }
                    }
                }
        }
    }

    /**
     * 메시지 목록 마지막 AI 메시지에 텍스트를 누적한다.
     * 스트리밍 특성상 이벤트마다 delta 텍스트가 도착하므로 append 방식으로 처리한다.
     */
    private fun appendToLastAiMessage(delta: String) {
        _messages.update { messages ->
            val lastIndex = messages.indexOfLast { !it.isFromUser }
            if (lastIndex == -1) return@update messages
            messages.toMutableList().also { list ->
                list[lastIndex] = list[lastIndex].copy(
                    content = list[lastIndex].content + delta
                )
            }
        }
    }

    /** 채팅 상태와 메시지 목록을 초기화한다 */
    fun reset() {
        _messages.value = emptyList()
        _uiState.value = ChatUiState.Idle
    }
}
