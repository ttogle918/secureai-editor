package io.secureai.android.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import io.secureai.android.data.local.dao.DashboardCacheDao
import io.secureai.android.data.local.dao.VulnerabilityDao
import io.secureai.android.data.local.entity.DashboardCacheEntity
import io.secureai.android.data.local.entity.VulnerabilityEntity

@Database(
    entities = [VulnerabilityEntity::class, DashboardCacheEntity::class],
    version = 1,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {
    abstract fun vulnerabilityDao(): VulnerabilityDao
    abstract fun dashboardCacheDao(): DashboardCacheDao
}
