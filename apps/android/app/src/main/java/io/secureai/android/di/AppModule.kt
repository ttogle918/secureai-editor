package io.secureai.android.di

import dagger.Binds
import dagger.Module
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import io.secureai.android.data.repository.AuthRepository
import io.secureai.android.data.repository.AuthRepositoryImpl
import javax.inject.Singleton

/**
 * 애플리케이션 전역 DI 바인딩 모듈.
 *
 * DIP 적용: AuthRepository 인터페이스 ↔ AuthRepositoryImpl 구현체를 연결한다.
 * ViewModel은 인터페이스에만 의존하므로 테스트 시 FakeAuthRepository로 교체 가능.
 */
@Module
@InstallIn(SingletonComponent::class)
abstract class AppModule {

    @Binds
    @Singleton
    abstract fun bindAuthRepository(impl: AuthRepositoryImpl): AuthRepository
}
