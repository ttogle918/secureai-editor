package io.secureai.android.ui.chat

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle

/**
 * AI 채팅 스트리밍 화면.
 *
 * 설계 원칙:
 * - SRP: UI 렌더링만 담당, 상태 관리는 ChatViewModel에 위임
 * - Stateless Composable: 상태는 ViewModel에서 StateFlow로 수신
 *
 * @param sessionId  SSE 구독 대상 세션 ID
 * @param onBack     뒤로가기 콜백
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatScreen(
    sessionId: String,
    onBack: () -> Unit = {},
    viewModel: ChatViewModel = hiltViewModel()
) {
    val messages by viewModel.messages.collectAsStateWithLifecycle()
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    val listState = rememberLazyListState()

    // 화면 진입 시 SSE 구독 시작
    LaunchedEffect(sessionId) {
        viewModel.startChat(sessionId)
    }

    // 새 메시지가 추가될 때마다 목록 맨 아래로 스크롤
    LaunchedEffect(messages.size) {
        if (messages.isNotEmpty()) {
            listState.animateScrollToItem(messages.lastIndex)
        }
    }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text("AI 보안 어시스턴트") }
            )
        }
    ) { innerPadding ->
        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(innerPadding)
                .imePadding()
        ) {
            // 메시지 목록
            LazyColumn(
                state = listState,
                modifier = Modifier
                    .weight(1f)
                    .fillMaxWidth()
                    .padding(horizontal = 12.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp)
            ) {
                items(messages) { message ->
                    ChatBubble(message = message)
                }

                // 스트리밍 중 로딩 인디케이터
                if (uiState is ChatUiState.Streaming && messages.lastOrNull()?.isFromUser == true) {
                    item {
                        Row(modifier = Modifier.padding(vertical = 4.dp)) {
                            CircularProgressIndicator(
                                modifier = Modifier
                                    .padding(start = 8.dp)
                                    .width(20.dp)
                            )
                        }
                    }
                }
            }

            // 오류 표시
            if (uiState is ChatUiState.Error) {
                Text(
                    text = (uiState as ChatUiState.Error).message,
                    color = MaterialTheme.colorScheme.error,
                    style = MaterialTheme.typography.bodySmall,
                    modifier = Modifier.padding(horizontal = 16.dp, vertical = 4.dp)
                )
            }

            // 입력창
            ChatInputBar(
                isEnabled = uiState !is ChatUiState.Streaming,
                onSend = { text ->
                    viewModel.addUserMessage(text)
                    viewModel.startChat(sessionId)
                }
            )
        }
    }
}

/**
 * 채팅 말풍선 컴포넌트.
 * 사용자 메시지는 오른쪽, AI 메시지는 왼쪽 정렬.
 */
@Composable
private fun ChatBubble(message: ChatMessage) {
    val bubbleColor = if (message.isFromUser) {
        MaterialTheme.colorScheme.primaryContainer
    } else {
        MaterialTheme.colorScheme.surfaceVariant
    }

    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = if (message.isFromUser) Arrangement.End else Arrangement.Start
    ) {
        Box(
            modifier = Modifier
                .widthIn(max = 280.dp)
                .background(color = bubbleColor, shape = RoundedCornerShape(12.dp))
                .padding(horizontal = 12.dp, vertical = 8.dp)
        ) {
            Text(
                text = message.content.ifEmpty { "..." },
                style = MaterialTheme.typography.bodyMedium
            )
        }
    }
}

/**
 * 메시지 입력창 + 전송 버튼.
 *
 * @param isEnabled  스트리밍 중에는 false로 비활성화
 * @param onSend     전송 콜백 (비어있는 입력 무시)
 */
@Composable
private fun ChatInputBar(
    isEnabled: Boolean,
    onSend: (String) -> Unit
) {
    var inputText by remember { mutableStateOf("") }

    fun sendIfNotEmpty() {
        val text = inputText.trim()
        if (text.isNotEmpty()) {
            onSend(text)
            inputText = ""
        }
    }

    Row(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(8.dp)
    ) {
        OutlinedTextField(
            value = inputText,
            onValueChange = { inputText = it },
            modifier = Modifier.weight(1f),
            placeholder = { Text("메시지 입력...") },
            enabled = isEnabled,
            keyboardOptions = KeyboardOptions(imeAction = ImeAction.Send),
            keyboardActions = KeyboardActions(onSend = { sendIfNotEmpty() }),
            singleLine = true
        )

        Button(
            onClick = { sendIfNotEmpty() },
            enabled = isEnabled && inputText.trim().isNotEmpty()
        ) {
            Text("전송")
        }
    }
}
