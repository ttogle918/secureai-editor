package io.secureai.android.ui.navigation

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.NavHostController
import androidx.navigation.NavType
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import androidx.navigation.navArgument
import androidx.navigation.navDeepLink
import io.secureai.android.ui.auth.AuthViewModel
import io.secureai.android.ui.auth.LoginScreen
import io.secureai.android.ui.auth.RegisterScreen
import io.secureai.android.ui.dashboard.DashboardScreen
import io.secureai.android.ui.vulndetail.VulnDetailScreen
import io.secureai.android.ui.vulnlist.VulnListScreen

// ────────────────────────────────────────────
// 화면 라우트 정의
// ────────────────────────────────────────────

/** 앱 내 화면 라우트를 sealed class로 명확히 정의 */
sealed class Screen(val route: String) {
    data object Login : Screen("login")
    data object Register : Screen("register")
    data object Dashboard : Screen("dashboard/{projectId}") {
        fun createRoute(projectId: String) = "dashboard/$projectId"
    }
    data object VulnList : Screen("vulnList/{projectId}") {
        fun createRoute(projectId: String) = "vulnList/$projectId"
    }
    data object VulnDetail : Screen("vulnDetail/{projectId}/{vulnId}") {
        fun createRoute(projectId: String, vulnId: String) = "vulnDetail/$projectId/$vulnId"
    }

    /** FCM 딥링크 진입점 — secureai://session/{sessionId} */
    data object Session : Screen("session/{sessionId}") {
        fun createRoute(sessionId: String) = "session/$sessionId"
        const val DEEP_LINK_URI = "secureai://session/{sessionId}"
    }
}

// ────────────────────────────────────────────
// NavGraph
// ────────────────────────────────────────────

private const val DEFAULT_PROJECT_ID = "default"

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
        Screen.Dashboard.createRoute(DEFAULT_PROJECT_ID)
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
                    navController.navigate(Screen.Dashboard.createRoute(DEFAULT_PROJECT_ID)) {
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
                    navController.navigate(Screen.Dashboard.createRoute(DEFAULT_PROJECT_ID)) {
                        // 회원가입 성공 후 Login, Register 모두 back stack에서 제거
                        popUpTo(Screen.Login.route) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.popBackStack()
                }
            )
        }

        composable(
            route = Screen.Dashboard.route,
            arguments = listOf(navArgument("projectId") { type = NavType.StringType })
        ) { backStackEntry ->
            val projectId = backStackEntry.arguments?.getString("projectId") ?: DEFAULT_PROJECT_ID
            DashboardScreen(
                projectId = projectId,
                onLogout = {
                    navController.navigate(Screen.Login.route) {
                        popUpTo(0) { inclusive = true }
                    }
                },
                onNavigateToVulnList = { pid ->
                    navController.navigate(Screen.VulnList.createRoute(pid))
                }
            )
        }

        composable(
            route = Screen.VulnList.route,
            arguments = listOf(navArgument("projectId") { type = NavType.StringType })
        ) { backStackEntry ->
            val projectId = backStackEntry.arguments?.getString("projectId") ?: DEFAULT_PROJECT_ID
            VulnListScreen(
                projectId = projectId,
                onNavigateToDetail = { pid, vulnId ->
                    navController.navigate(Screen.VulnDetail.createRoute(pid, vulnId))
                },
                onBack = { navController.popBackStack() }
            )
        }

        composable(
            route = Screen.VulnDetail.route,
            arguments = listOf(
                navArgument("projectId") { type = NavType.StringType },
                navArgument("vulnId") { type = NavType.StringType }
            )
        ) { backStackEntry ->
            val projectId = backStackEntry.arguments?.getString("projectId") ?: DEFAULT_PROJECT_ID
            val vulnId = backStackEntry.arguments?.getString("vulnId") ?: ""
            VulnDetailScreen(
                projectId = projectId,
                vulnId = vulnId,
                onBack = { navController.popBackStack() }
            )
        }

        // FCM 딥링크 진입점: secureai://session/{sessionId}
        // sessionId로 대시보드 화면으로 리다이렉트
        composable(
            route = Screen.Session.route,
            arguments = listOf(
                navArgument("sessionId") { type = NavType.StringType }
            ),
            deepLinks = listOf(
                navDeepLink { uriPattern = Screen.Session.DEEP_LINK_URI }
            )
        ) { backStackEntry ->
            val sessionId = backStackEntry.arguments?.getString("sessionId") ?: return@composable
            // 세션 ID로 직접 대시보드 이동 (projectId는 기본값 사용, 실제 구현에서는 세션 API로 조회)
            navController.navigate(Screen.Dashboard.createRoute(DEFAULT_PROJECT_ID)) {
                popUpTo(Screen.Session.route) { inclusive = true }
            }
        }
    }
}
