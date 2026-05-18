package io.secureai.android.ui.navigation

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import io.secureai.android.ui.auth.AuthViewModel
import io.secureai.android.ui.auth.LoginScreen
import io.secureai.android.ui.auth.RegisterScreen
import io.secureai.android.ui.dashboard.DashboardScreen

// ────────────────────────────────────────────
// 화면 라우트 정의
// ────────────────────────────────────────────

/** 앱 내 화면 라우트를 sealed class로 명확히 정의 */
sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object Dashboard : Screen("dashboard")
}

// ────────────────────────────────────────────
// NavGraph
// ────────────────────────────────────────────

/**
 * 앱 전체 NavHost 설정.
 *
 * 인증 상태 기반 startDestination 결정:
 * - 저장된 토큰이 있으면 → Dashboard (자동 로그인)
 * - 없으면 → Login 화면
 */
@Composable
fun AppNavGraph(
    navController: NavHostController = rememberNavController(),
    authViewModel: AuthViewModel = hiltViewModel()
) {
    // ViewModel에서 저장된 토큰 여부 확인 — 시작 화면 결정
    val startDestination = if (authViewModel.isLoggedIn()) {
        Screen.Dashboard.route
    } else {
        Screen.Login.route
    }

    NavHost(
        navController = navController,
        startDestination = startDestination
    ) {
        composable(Screen.Login.route) {
            LoginScreen(
                onNavigateToDashboard = {
                    navController.navigate(Screen.Dashboard.route) {
                        // 로그인 성공 후 back stack에서 Login 화면 제거
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToRegister = {
                    navController.navigate(Screen.Register.route)
                }
            )
        }

        composable(Screen.Register.route) {
            RegisterScreen(
                onNavigateToDashboard = {
                    navController.navigate(Screen.Dashboard.route) {
                        // 회원가입 성공 후 Login, Register 모두 back stack에서 제거
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.popBackStack()
                }
            )
        }

        composable(Screen.Dashboard.route) {
            DashboardScreen(
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(Screen.Dashboard.route) { inclusive = true }
                    }
                }
            )
        }
    }
}
