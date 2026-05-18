package io.secureai.android.data.repository

/**
 * 인증 도메인 Repository 인터페이스.
 *
 * DIP 적용: ViewModel은 구체 구현체(AuthRepositoryImpl)가 아닌
 * 이 인터페이스에만 의존한다. 테스트 시 가짜 구현체로 교체 가능.
 */
interface AuthRepository {

    /**
     * 이메일/패스워드로 로그인하고 토큰을 저장한다.
     * 성공 시 Unit, 실패 시 예외를 던진다.
     */
    suspend fun login(email: String, password: String)

    /**
     * 신규 계정을 생성하고 토큰을 저장한다.
     * 성공 시 Unit, 실패 시 예외를 던진다.
     */
    suspend fun register(email: String, password: String, username: String)

    /** 로그아웃 — 저장된 토큰을 삭제한다. */
    fun logout()

    /** 저장된 accessToken이 있으면 true */
    fun isLoggedIn(): Boolean
}
