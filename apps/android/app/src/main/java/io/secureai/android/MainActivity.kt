package io.secureai.android

import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import dagger.hilt.android.AndroidEntryPoint
import io.secureai.android.ui.navigation.AppNavGraph
import io.secureai.android.ui.theme.SecureAiTheme

/**
 * 앱의 단일 Activity.
 *
 * @AndroidEntryPoint: Hilt가 이 Activity에 의존성을 주입할 수 있도록 한다.
 * Compose UI의 루트는 AppNavGraph — 인증 상태에 따라 시작 화면을 결정한다.
 */
@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        setContent {
            SecureAiTheme {
                AppNavGraph()
            }
        }
    }
}
