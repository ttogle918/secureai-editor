package io.secureai.android.data.repository

import io.secureai.android.data.remote.model.DashboardResponse

/** 대시보드 데이터 접근 계약 — ViewModel은 이 인터페이스에만 의존한다. */
interface DashboardRepository {

    /**
     * 대시보드 데이터를 반환한다.
     * - 네트워크 성공: 서버 응답을 Room에 JSON으로 캐싱 후 반환
     * - 네트워크 실패: 캐시된 JSON을 파싱해서 반환
     */
    suspend fun getDashboard(projectId: String): DashboardResponse
}
