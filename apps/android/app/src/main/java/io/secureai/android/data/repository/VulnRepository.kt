package io.secureai.android.data.repository

import io.secureai.android.data.local.entity.VulnerabilityEntity
import io.secureai.android.data.remote.model.VulnerabilityDto
import kotlinx.coroutines.flow.Flow

/** 취약점 데이터 접근 계약 — ViewModel은 이 인터페이스에만 의존한다. */
interface VulnRepository {

    /**
     * 프로젝트의 취약점 목록을 반환한다.
     * - 네트워크 성공: 서버 데이터를 Room에 캐싱 후 Flow로 방출
     * - 네트워크 실패: Room 캐시를 그대로 방출 (오프라인 지원)
     */
    fun getVulnerabilities(projectId: String): Flow<List<VulnerabilityEntity>>

    /** ID로 단건 취약점을 반환한다. Room 캐시를 우선 조회한다. */
    suspend fun getVulnerabilityDetail(projectId: String, vulnId: String): VulnerabilityDto
}
