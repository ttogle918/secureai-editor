package io.secureai.android.di

import android.content.Context
import androidx.room.Room
import com.google.gson.Gson
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import io.secureai.android.data.local.AppDatabase
import io.secureai.android.data.local.dao.DashboardCacheDao
import io.secureai.android.data.local.dao.VulnerabilityDao
import io.secureai.android.data.remote.api.DashboardApi
import io.secureai.android.data.repository.DashboardRepository
import io.secureai.android.data.repository.DashboardRepositoryImpl
import io.secureai.android.data.repository.VulnRepository
import io.secureai.android.data.repository.VulnRepositoryImpl
import retrofit2.Retrofit
import javax.inject.Singleton

/**
 * Room DB 및 Dashboard 관련 Hilt DI 모듈.
 *
 * SRP: DB 생성과 Repository 바인딩만 담당한다.
 * DIP: VulnRepository/DashboardRepository 인터페이스에만 의존한다.
 */
@Module
@InstallIn(SingletonComponent::class)
object DatabaseModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase =
        Room.databaseBuilder(context, AppDatabase::class.java, "secureai.db").build()

    @Provides
    @Singleton
    fun provideVulnerabilityDao(db: AppDatabase): VulnerabilityDao = db.vulnerabilityDao()

    @Provides
    @Singleton
    fun provideDashboardCacheDao(db: AppDatabase): DashboardCacheDao = db.dashboardCacheDao()

    @Provides
    @Singleton
    fun provideGson(): Gson = Gson()

    @Provides
    @Singleton
    fun provideDashboardApi(retrofit: Retrofit): DashboardApi =
        retrofit.create(DashboardApi::class.java)

    @Provides
    @Singleton
    fun provideDashboardRepository(impl: DashboardRepositoryImpl): DashboardRepository = impl

    @Provides
    @Singleton
    fun provideVulnRepository(impl: VulnRepositoryImpl): VulnRepository = impl
}
