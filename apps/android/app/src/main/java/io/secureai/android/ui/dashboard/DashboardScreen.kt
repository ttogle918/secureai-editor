package io.secureai.android.ui.dashboard

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.secureai.android.data.remote.model.SeverityCounts

private const val DEFAULT_PROJECT_ID = "default"

private val CRITICAL_COLOR = Color(0xFFB71C1C)
private val HIGH_COLOR = Color(0xFFE65100)
private val MEDIUM_COLOR = Color(0xFFF9A825)
private val LOW_COLOR = Color(0xFF1565C0)
private val INFO_COLOR = Color(0xFF616161)

/**
 * 대시보드 화면.
 *
 * UiState에 따라 로딩 인디케이터, 보안 점수 게이지, 심각도 카운트, 취약점 목록 이동 버튼을 표시한다.
 */
@Composable
fun DashboardScreen(
    onLogout: () -> Unit,
    onNavigateToVulnList: (projectId: String) -> Unit = {},
    projectId: String = DEFAULT_PROJECT_ID,
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(projectId) {
        viewModel.loadDashboard(projectId)
    }

    when (val state = uiState) {
        is DashboardUiState.Loading -> LoadingContent()
        is DashboardUiState.Success -> SuccessContent(
            uiState = state,
            projectId = projectId,
            onNavigateToVulnList = onNavigateToVulnList,
            onLogout = {
                viewModel.logout()
                onLogout()
            }
        )
        is DashboardUiState.Error -> ErrorContent(
            message = state.message,
            onRetry = { viewModel.loadDashboard(projectId) },
            onLogout = {
                viewModel.logout()
                onLogout()
            }
        )
    }
}

@Composable
private fun LoadingContent() {
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}

@Composable
private fun SuccessContent(
    uiState: DashboardUiState.Success,
    projectId: String,
    onNavigateToVulnList: (String) -> Unit,
    onLogout: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = "보안 점수",
            style = MaterialTheme.typography.titleLarge
        )

        Spacer(modifier = Modifier.height(8.dp))

        SecurityScoreGauge(score = uiState.data.securityScore)

        Spacer(modifier = Modifier.height(24.dp))

        SeverityCountsRow(counts = uiState.data.severityCounts)

        Spacer(modifier = Modifier.height(32.dp))

        Button(
            onClick = { onNavigateToVulnList(projectId) },
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("취약점 목록 보기")
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(
            onClick = onLogout,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("로그아웃")
        }
    }
}

@Composable
private fun SeverityCountsRow(counts: SeverityCounts) {
    Row(
        modifier = Modifier.fillMaxWidth(),
        horizontalArrangement = Arrangement.SpaceEvenly
    ) {
        SeverityBadge(label = "CRITICAL", count = counts.CRITICAL, color = CRITICAL_COLOR)
        SeverityBadge(label = "HIGH", count = counts.HIGH, color = HIGH_COLOR)
        SeverityBadge(label = "MEDIUM", count = counts.MEDIUM, color = MEDIUM_COLOR)
        SeverityBadge(label = "LOW", count = counts.LOW, color = LOW_COLOR)
        SeverityBadge(label = "INFO", count = counts.INFO, color = INFO_COLOR)
    }
}

@Composable
private fun SeverityBadge(label: String, count: Int, color: Color) {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text(
            text = "$count",
            style = MaterialTheme.typography.titleMedium,
            color = color
        )
        Text(
            text = label,
            style = MaterialTheme.typography.labelSmall,
            color = color
        )
    }
}

@Composable
private fun ErrorContent(
    message: String,
    onRetry: () -> Unit,
    onLogout: () -> Unit
) {
    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        Text(
            text = message,
            color = MaterialTheme.colorScheme.error,
            style = MaterialTheme.typography.bodyMedium
        )

        Spacer(modifier = Modifier.height(16.dp))

        Button(onClick = onRetry) {
            Text("다시 시도")
        }

        Spacer(modifier = Modifier.height(8.dp))

        OutlinedButton(onClick = onLogout) {
            Text("로그아웃")
        }
    }
}
