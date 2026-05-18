package io.secureai.android.data.local.dao

import androidx.room.Dao
import androidx.room.Query
import androidx.room.Upsert
import io.secureai.android.data.local.entity.DashboardCacheEntity

@Dao
interface DashboardCacheDao {

    @Query("SELECT * FROM dashboard_cache WHERE projectId = :projectId")
    suspend fun getByProject(projectId: String): DashboardCacheEntity?

    @Upsert
    suspend fun upsert(entity: DashboardCacheEntity)
}
