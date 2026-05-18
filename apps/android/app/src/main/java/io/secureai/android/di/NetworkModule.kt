package io.secureai.android.di

import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.secureai.android.BuildConfig
import io.secureai.android.data.local.TokenStorage
import io.secureai.android.data.remote.AuthApi
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton

/**
 * 네트워크 레이어 Hilt DI 모듈.
 *
 * 설계 원칙:
 * - DIP: AuthApi 인터페이스에만 의존 (Retrofit 구현체 주입)
 * - SRP: 네트워크 설정만 담당 (비즈니스 로직 없음)
 *
 * 보안 규칙:
 * - HttpLoggingInterceptor는 DEBUG 빌드에서만 BODY 레벨 로그 출력
 * - Authorization 헤더에 토큰을 포함하되 로그에는 출력되지 않도록 레벨 제한
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideOkHttpClient(tokenStorage: TokenStorage): OkHttpClient {
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            // release 빌드에서 토큰·바디가 로그에 노출되지 않도록 NONE 레벨 적용
            level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BODY
                    else HttpLoggingInterceptor.Level.NONE
        }

        return OkHttpClient.Builder()
            .addInterceptor { chain ->
                val token = tokenStorage.getAccessToken()
                val request = if (token != null) {
                    chain.request().newBuilder()
                        .addHeader("Authorization", "Bearer $token")
                        .build()
                } else {
                    chain.request()
                }
                chain.proceed(request)
            }
            .addInterceptor(loggingInterceptor)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit = Retrofit.Builder()
        .baseUrl(BuildConfig.API_BASE_URL)
        .client(okHttpClient)
        .addConverterFactory(GsonConverterFactory.create())
        .build()

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)
}
