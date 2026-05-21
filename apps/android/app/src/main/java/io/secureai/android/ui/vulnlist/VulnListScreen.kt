package io.secureai.android.ui.vulnlist

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.ArrowBack
import androidx.compose.material3.Card
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
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import io.secureai.android.data.local.entity.VulnerabilityEntity

private val CRITICAL_COLOR = Color(0xFFB71C1C)
private val HIGH_COLOR = Color(0xFFE65100)
private val MEDIUM_COLOR = Color(0xFFF9A825)
private val LOW_COLOR = Color(0xFF1565C0)
private val INFO_COLOR = Color(0xFF616161)

fun severityColor(severity: String): Color = when (severity.uppercase()) {
    "CRITICAL" -> CRITICAL_COLOR
    "HIGH" -> HIGH_COLOR
    "MEDIUM" -> MEDIUM_COLOR
    "LOW" -> LOW_COLOR
    else -> INFO_COLOR
}

/**
 * 취약점 목록 화면.
 *
 * LazyColumn으로 취약점 아이템을 나열하고, 클릭 시 상세 화면으로 이동한다.
 */
@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun VulnListScreen(
    projectId: String,
    onNavigateToDetail: (projectId: String, vulnId: String) -> Unit,
    onBack: () -> Unit,
    viewModel: VulnListViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()

    LaunchedEffect(projectId) {
        viewModel.loadVulnerabilities(projectId)
    }

    Column(modifier = Modifier.fillMaxSize()) {
        TopAppBar(
            title = { Text("취약점 목록") },
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
            is VulnListUiState.Loading -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                CircularProgressIndicator()
            }

            is VulnListUiState.Success -> VulnList(
                items = state.vulnerabilities,
                onItemClick = { vuln ->
                    onNavigateToDetail(projectId, vuln.id)
                }
            )

            is VulnListUiState.Error -> Box(
                modifier = Modifier.fillMaxSize(),
                contentAlignment = Alignment.Center
            ) {
                Text(
                    text = state.message,
                    color = MaterialTheme.colorScheme.error
                )
            }
        }
    }
}

@Composable
private fun VulnList(
    items: List<VulnerabilityEntity>,
    onItemClick: (VulnerabilityEntity) -> Unit
) {
    LazyColumn {
        items(items, key = { it.id }) { vuln ->
            VulnListItem(vuln = vuln, onClick = { onItemClick(vuln) })
        }
    }
}

@Composable
private fun VulnListItem(
    vuln: VulnerabilityEntity,
    onClick: () -> Unit
) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .padding(horizontal = 16.dp, vertical = 4.dp)
            .clickable(onClick = onClick)
    ) {
        Row(
            modifier = Modifier.padding(12.dp),
            verticalAlignment = Alignment.CenterVertically
        ) {
            SuggestionChip(
                onClick = {},
                label = { Text(vuln.severity, color = Color.White) },
                colors = SuggestionChipDefaults.suggestionChipColors(
                    containerColor = severityColor(vuln.severity)
                )
            )

            Spacer(modifier = Modifier.width(12.dp))

            Column(modifier = Modifier.weight(1f)) {
                Text(
                    text = vuln.title,
                    style = MaterialTheme.typography.bodyLarge,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
                Text(
                    text = vuln.filePath,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis
                )
            }
        }
    }
}
