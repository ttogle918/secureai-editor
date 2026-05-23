package io.secureai.android.data.repository

import android.util.Log
import io.secureai.android.data.local.dao.VulnerabilityDao
import io.secureai.android.data.local.entity.VulnerabilityEntity
import io.secureai.android.data.remote.api.DashboardApi
import io.secureai.android.data.remote.model.VulnerabilityDto
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.onStart
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "VulnRepositoryImpl"
private const val CACHE_TTL_MS = 24 * 60 * 60 * 1000L // 24시간

@Singleton
class VulnRepositoryImpl @Inject constructor(
    private val api: DashboardApi,
    private val dao: VulnerabilityDao
) : VulnRepository {

    override fun getVulnerabilities(projectId: String): Flow<List<VulnerabilityEntity>> {
        return dao.getByProject(projectId).onStart {
            refreshVulnerabilities(projectId)
        }
    }

    /** 서버에서 최신 데이터를 가져와 캐시를 갱신한다. 실패 시 기존 캐시를 유지한다. */
    private suspend fun refreshVulnerabilities(projectId: String) {
        try {
            val response = api.getVulnerabilities(projectId).requireData()
            val entities = response.content.map { it.toEntity(projectId) }
            dao.upsertAll(entities)
            dao.deleteStale(projectId, System.currentTimeMillis() - CACHE_TTL_MS)
        } catch (e: Exception) {
            Log.e(TAG, "취약점 목록 갱신 실패 — 캐시 사용: ${e.javaClass.simpleName}")
        }
    }

    override suspend fun getVulnerabilityDetail(projectId: String, vulnId: String): VulnerabilityDto {
        return api.getVulnerabilityDetail(projectId, vulnId).requireData()
    }

    private fun VulnerabilityDto.toEntity(projectId: String) = VulnerabilityEntity(
        id = id,
        projectId = projectId,
        filePath = filePath,
        lineNumber = lineNumber,
        severity = severity,
        title = title,
        description = description,
        owaspCategory = owaspCategory,
        cweId = cweId,
        patchSuggestion = patchSuggestion
    )
}
