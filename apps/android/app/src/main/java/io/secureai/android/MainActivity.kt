package io.secureai.android

import android.content.Intent
import android.os.Bundle
import android.util.Log
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.navigation.NavController
import androidx.navigation.compose.rememberNavController
import dagger.hilt.android.AndroidEntryPoint
import io.secureai.android.ui.navigation.AppNavGraph
import io.secureai.android.ui.navigation.Screen
import io.secureai.android.ui.theme.SecureAiTheme

private const val TAG = "MainActivity"
private const val SESSION_ID_PATTERN = "[0-9a-f\\-]{36}"

/**
 * 앱의 단일 Activity.
 *
 * @AndroidEntryPoint: Hilt가 이 Activity에 의존성을 주입할 수 있도록 한다.
 * Compose UI의 루트는 AppNavGraph — 인증 상태에 따라 시작 화면을 결정한다.
 *
 * launchMode="singleTop"으로 선언되어 딥링크 재진입 시 새 인스턴스를 만들지 않고
 * onNewIntent()로 처리한다.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    private var navController: NavController? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SecureAiTheme {
                val navController = rememberNavController().also { this.navController = it }
                AppNavGraph(navController = navController)
            }
        }
        // 앱이 종료 상태에서 딥링크로 진입한 경우 처리
        handleDeepLinkIntent(intent)
    }

    /**
     * launchMode="singleTop" 덕분에 앱이 이미 실행 중일 때 딥링크 클릭 시 호출된다.
     * FCM 알림 클릭으로 앱이 foreground로 전환될 때 이 경로를 탄다.
     */
    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        handleDeepLinkIntent(intent)
    }

    /**
     * secureai://session/{sessionId} 딥링크를 파싱하여 Session 화면으로 내비게이션한다.
     *
     * 보안: sessionId는 UUID 형식([0-9a-f-]{36}) 검증 후 사용 (경로 삽입 방지)
     */
    private fun handleDeepLinkIntent(intent: Intent) {
        val uri = intent.data ?: return
        if (uri.scheme != "secureai" || uri.host != "session") return

        val sessionId = uri.lastPathSegment ?: return
        if (!sessionId.matches(Regex(SESSION_ID_PATTERN))) {
            Log.w(TAG, "Invalid sessionId format in deep link, ignoring")
            return
        }

        // NavController가 준비된 후 이동 — Compose 초기화 완료 시점 이후
        navController?.navigate(Screen.Session.createRoute(sessionId)) {
            launchSingleTop = true
        }
    }
}
