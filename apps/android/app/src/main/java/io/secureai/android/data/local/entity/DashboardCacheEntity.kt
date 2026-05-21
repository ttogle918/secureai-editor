package io.secureai.android.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

/** 대시보드 API 응답을 JSON으로 직렬화하여 오프라인 캐시로 저장한다. */
@Entity(tableName = "dashboard_cache")
data class DashboardCacheEntity(
    @PrimaryKey val projectId: String,
    val json: String,
    val cachedAt: Long = System.currentTimeMillis()
)
