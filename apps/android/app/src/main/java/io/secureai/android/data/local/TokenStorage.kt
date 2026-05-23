package io.secureai.android.data.local

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

/**
 * JWT 토큰을 Android Keystore 기반 EncryptedSharedPreferences에 안전하게 저장한다.
 *
 * 보안 규칙:
 * - 평문 SharedPreferences 절대 사용 금지
 * - 토큰 값은 로그에 절대 출력 금지
 * - 암호화 키는 Android Keystore에서 관리 (AES256_GCM)
 */
@Singleton
class TokenStorage @Inject constructor(
    @ApplicationContext private val context: Context
) {
    companion object {
        private const val PREFS_FILE_NAME = "secureai_token_prefs"
        private const val KEY_ACCESS_TOKEN = "access_token"
        private const val KEY_REFRESH_TOKEN = "refresh_token"
    }

    // MasterKey는 Android Keystore에 AES256_GCM 키를 생성·관리한다
    private val masterKey: MasterKey by lazy {
        MasterKey.Builder(context)
            .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
            .build()
    }

    private val encryptedPrefs by lazy {
        EncryptedSharedPreferences.create(
            context,
            PREFS_FILE_NAME,
            masterKey,
            EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
            EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
        )
    }

    /**
     * 로그인/토큰 갱신 시 accessToken과 refreshToken을 암호화 저장한다.
     * 토큰 값은 로그에 출력하지 않는다.
     */
    fun saveTokens(accessToken: String, refreshToken: String) {
        encryptedPrefs.edit()
            .putString(KEY_ACCESS_TOKEN, accessToken)
            .putString(KEY_REFRESH_TOKEN, refreshToken)
            .apply()
    }

    /**
     * HTTP 요청 Authorization 헤더에 사용할 accessToken을 반환한다.
     * 저장된 토큰이 없으면 null 반환.
     */
    fun getAccessToken(): String? = encryptedPrefs.getString(KEY_ACCESS_TOKEN, null)

    /**
     * 토큰 갱신(refresh) 요청에 사용할 refreshToken을 반환한다.
     * 저장된 토큰이 없으면 null 반환.
     */
    fun getRefreshToken(): String? = encryptedPrefs.getString(KEY_REFRESH_TOKEN, null)

    /**
     * 로그아웃 또는 세션 만료 시 저장된 모든 토큰을 삭제한다.
     */
    fun clear() {
        encryptedPrefs.edit()
            .remove(KEY_ACCESS_TOKEN)
            .remove(KEY_REFRESH_TOKEN)
            .apply()
    }

    /** 저장된 토큰이 있으면 true — 로그인 여부 판단에 사용 */
    fun hasToken(): Boolean = getAccessToken() != null
}
