package io.secureai.android.ui.dashboard

import androidx.lifecycle.ViewModel
import dagger.hilt.android.lifecycle.HiltViewModel
import io.secureai.android.data.repository.AuthRepository
import javax.inject.Inject

/**
 * 대시보드 ViewModel — 현재는 로그아웃 처리만 담당.
 * Sprint 7 Stage 2(TASK-704)에서 프로젝트 목록 조회 등이 추가될 예정.
 */
@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    fun logout() {
        authRepository.logout()
    }
}
