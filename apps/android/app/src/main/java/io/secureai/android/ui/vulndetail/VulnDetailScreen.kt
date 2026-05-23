package io.secureai.android.ui.vulndetail

import androidx.compose.foundation.background
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.SuggestionChip
import androidx.compose.material3.SuggestionChipDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBar
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.secureai.android.data.remote.model.VulnerabilityDto
import io.secureai.android.ui.vulnlist.severityColor

private val CODE_BLOCK_BACKGROUND = Color(0xFF1E1E1E)
private val CODE_BLOCK_TEXT = Color(0xFFD4D4D4)

/**
 * 취약점 상세 화면.
 *
 * ViewModel에서 데이터를 로드하고, UiState에 따라 로딩/에러/내용을 표시한다.
 * 심각도 배지, 파일 경로, CWE/OWASP, 설명, 패치 제안을 표시한다.
 * 패치 코드가 있으면 monospace 폰트 + 어두운 배경 코드 블록으로 표시한다.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VulnDetailScreen(
    projectId: String,
    vulnId: String,
    onBack: () -> Unit,
    viewModel: VulnDetailViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(projectId, vulnId) {
        viewModel.loadDetail(projectId, vulnId)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("취약점 상세") },
            navigationIcon = {
                IconButton(onClick = onBack) {
                    Icon(
                        imageVector = Icons.AutoMirrored.Filled.ArrowBack,
                        contentDescription = "뒤로 가기"
                    )
                }
            }
        )

        when (val state = uiState) {
            is VulnDetailUiState.Loading -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }

            is VulnDetailUiState.Error -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(text = state.message, color = MaterialTheme.colorScheme.error)
            }

            is VulnDetailUiState.Success -> VulnDetailContent(vuln = state.vuln)
        }
    }
}

@Composable
private fun VulnDetailContent(vuln: VulnerabilityDto) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .verticalScroll(rememberScrollState())
            .padding(16.dp)
    ) {
        // 심각도 배지 + 제목
        Row(verticalAlignment = Alignment.CenterVertically) {
            SuggestionChip(
                onClick = {},
                label = { Text(vuln.severity, color = Color.White) },
                colors = SuggestionChipDefaults.suggestionChipColors(
                    containerColor = severityColor(vuln.severity)
                )
            )
        }

        Spacer(modifier = Modifier.height(8.dp))

        Text(
            text = vuln.title,
            style = MaterialTheme.typography.headlineSmall
        )

        Spacer(modifier = Modifier.height(16.dp))

        // 파일 경로 + 라인 번호
        DetailSection(label = "파일 경로") {
            val locationText = if (vuln.lineNumber != null) {
                "${vuln.filePath}:${vuln.lineNumber}"
            } else {
                vuln.filePath
            }
            Text(
                text = locationText,
                style = MaterialTheme.typography.bodyMedium,
                fontFamily = FontFamily.Monospace
            )
        }

        Spacer(modifier = Modifier.height(12.dp))

        // CWE ID / OWASP 카테고리
        if (vuln.cweId != null || vuln.owaspCategory != null) {
            DetailSection(label = "분류") {
                vuln.cweId?.let {
                    Text(text = "CWE: $it", style = MaterialTheme.typography.bodyMedium)
                }
                vuln.owaspCategory?.let {
                    Text(text = "OWASP: $it", style = MaterialTheme.typography.bodyMedium)
                }
            }

            Spacer(modifier = Modifier.height(12.dp))
        }

        // 설명
        vuln.description?.let { desc ->
            DetailSection(label = "설명") {
                Text(text = desc, style = MaterialTheme.typography.bodyMedium)
            }

            Spacer(modifier = Modifier.height(12.dp))
        }

        // 패치 제안
        vuln.patchSuggestion?.let { patch ->
            DetailSection(label = "패치 제안") {
                Box(
                    modifier = Modifier
                        .fillMaxWidth()
                        .background(CODE_BLOCK_BACKGROUND, shape = RoundedCornerShape(8.dp))
                        .padding(12.dp)
                        .horizontalScroll(rememberScrollState())
                ) {
                    Text(
                        text = patch,
                        fontFamily = FontFamily.Monospace,
                        color = CODE_BLOCK_TEXT,
                        style = MaterialTheme.typography.bodySmall
                    )
                }
            }
        }
    }
}

@Composable
private fun DetailSection(
    label: String,
    content: @Composable () -> Unit
) {
    Text(
        text = label,
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.primary
    )
    Spacer(modifier = Modifier.height(4.dp))
    content()
}
