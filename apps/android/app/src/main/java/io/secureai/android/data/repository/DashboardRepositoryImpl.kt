package io.secureai.android.data.repository

import android.util.Log
import com.google.gson.Gson
import io.secureai.android.data.local.dao.DashboardCacheDao
import io.secureai.android.data.local.entity.DashboardCacheEntity
import io.secureai.android.data.remote.api.DashboardApi
import io.secureai.android.data.remote.model.DashboardResponse
import javax.inject.Inject
import javax.inject.Singleton

private const val TAG = "DashboardRepositoryImpl"

@Singleton
class DashboardRepositoryImpl @Inject constructor(
    private val api: DashboardApi,
    private val cacheDao: DashboardCacheDao,
    private val gson: Gson
) : DashboardRepository {

    override suspend fun getDashboard(projectId: String): DashboardResponse {
        return try {
            val response = api.getDashboard(projectId).requireData()
            cacheDao.upsert(
                DashboardCacheEntity(
                    projectId = projectId,
                    json = gson.toJson(response)
                )
            )
            response
        } catch (e: Exception) {
            Log.e(TAG, "대시보드 데이터 로드 실패 — 캐시 조회: ${e.javaClass.simpleName}")
            val cached = cacheDao.getByProject(projectId)
                ?: throw IllegalStateException("캐시된 대시보드 데이터가 없습니다.", e)
            gson.fromJson(cached.json, DashboardResponse::class.java)
        }
    }
}
