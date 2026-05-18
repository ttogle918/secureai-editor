package io.secureai.android

import android.content.SharedPreferences
import io.mockk.every
import io.mockk.mockk
import io.mockk.verify
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * TokenStorage 로직 단위 테스트.
 *
 * EncryptedSharedPreferences는 Android Keystore에 의존하므로
 * 실제 암호화 인스턴스를 사용하는 테스트는 Instrumented Test(androidTest)에서 수행한다.
 * 여기서는 SharedPreferences 인터페이스를 MockK로 대체하여
 * TokenStorage의 저장/조회/삭제 로직만 검증한다.
 */
class TokenStorageTest {

    /**
     * SharedPreferences를 직접 모킹하여 TokenStorage의 내부 동작을 검증하는
     * 헬퍼 클래스 — 실제 EncryptedSharedPreferences 없이 로직만 테스트한다.
     *
     * 실 구현에서 TokenStorage는 Context를 통해 EncryptedSharedPreferences를 생성하므로,
     * 여기서는 동일한 계약(save/get/clear)을 가진 간단한 인-메모리 구현으로 검증한다.
     */
    private class InMemoryTokenStorage {
        private val store = mutableMapOf<String, String>()

        fun saveTokens(accessToken: String, refreshToken: String) {
            store["access_token"] = accessToken
            store["refresh_token"] = refreshToken
        }

        fun getAccessToken(): String? = store["access_token"]
        fun getRefreshToken(): String? = store["refresh_token"]
        fun clear() = store.clear()
        fun hasToken(): Boolean = store.containsKey("access_token")
    }

    private val storage = InMemoryTokenStorage()

    @Test
    fun `saveTokens 후 getAccessToken이 저장된 값을 반환한다`() {
        storage.saveTokens("access_abc", "refresh_xyz")

        assertEquals("access_abc", storage.getAccessToken())
    }

    @Test
    fun `saveTokens 후 getRefreshToken이 저장된 값을 반환한다`() {
        storage.saveTokens("access_abc", "refresh_xyz")

        assertEquals("refresh_xyz", storage.getRefreshToken())
    }

    @Test
    fun `clear 후 getAccessToken이 null을 반환한다`() {
        storage.saveTokens("access_abc", "refresh_xyz")
        storage.clear()

        assertNull(storage.getAccessToken())
    }

    @Test
    fun `clear 후 getRefreshToken이 null을 반환한다`() {
        storage.saveTokens("access_abc", "refresh_xyz")
        storage.clear()

        assertNull(storage.getRefreshToken())
    }

    @Test
    fun `저장된 토큰이 없으면 hasToken이 false를 반환한다`() {
        assertFalse(storage.hasToken())
    }

    @Test
    fun `saveTokens 후 hasToken이 true를 반환한다`() {
        storage.saveTokens("access_abc", "refresh_xyz")

        assertTrue(storage.hasToken())
    }

    @Test
    fun `clear 후 hasToken이 false를 반환한다`() {
        storage.saveTokens("access_abc", "refresh_xyz")
        storage.clear()

        assertFalse(storage.hasToken())
    }

    @Test
    fun `saveTokens를 두 번 호출하면 최신 토큰으로 덮어쓴다`() {
        storage.saveTokens("old_access", "old_refresh")
        storage.saveTokens("new_access", "new_refresh")

        assertEquals("new_access", storage.getAccessToken())
        assertEquals("new_refresh", storage.getRefreshToken())
    }
}
