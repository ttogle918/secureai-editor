package io.secureai.android.notification

import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Intent
import android.net.Uri
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.ProcessLifecycleOwner
import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import dagger.hilt.android.EntryPointAccessors
import dagger.hilt.components.SingletonComponent
import dagger.hilt.EntryPoint
import dagger.hilt.InstallIn
import io.secureai.android.MainActivity
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

private const val TAG = "SecureAiFcmService"
private const val NOTIFICATION_CHANNEL_ID = "analysis_complete"
private const val SESSION_ID_PATTERN = "[0-9a-f\\-]{36}"

/**
 * FCM 메시지 수신 서비스.
 *
 * 설계 원칙:
 * - Service는 @AndroidEntryPoint 불가 → EntryPointAccessors로 Hilt 의존성 획득
 * - 이중 전략 경계: foreground 상태면 알림 skip (SSE가 담당)
 * - SRP: 알림 표시와 토큰 등록 책임을 별도 함수로 분리
 *
 * 보안 규칙:
 * - FCM 토큰을 로그에 출력 금지
 * - sessionId는 UUID 형식 검증 후 딥링크에 사용
 */
class SecureAiFcmService : FirebaseMessagingService() {

    /**
     * Hilt EntryPoint — Service에서 SingletonComponent 의존성 접근
     */
    @EntryPoint
    @InstallIn(SingletonComponent::class)
    interface FcmEntryPoint {
        fun fcmTokenService(): FcmTokenService
    }

    private val serviceJob = SupervisorJob()
    private val serviceScope = CoroutineScope(serviceJob + Dispatchers.IO)

    override fun onNewToken(token: String) {
        // 보안: 토큰 값을 로그에 출력하지 않음
        Log.d(TAG, "FCM token refreshed")
        val entryPoint = EntryPointAccessors.fromApplication(
            applicationContext,
            FcmEntryPoint::class.java
        )
        serviceScope.launch {
            entryPoint.fcmTokenService().registerToken(token)
        }
    }

    override fun onMessageReceived(message: RemoteMessage) {
        val sessionId = message.data["sessionId"] ?: return
        val projectId = message.data["projectId"] ?: return

        // 보안: sessionId UUID 형식 검증 (경로 삽입 방지)
        if (!sessionId.matches(Regex(SESSION_ID_PATTERN))) {
            Log.w(TAG, "Invalid sessionId format in FCM message, ignoring")
            return
        }

        // 이중 전략 경계: foreground면 SSE가 처리 → 알림 skip
        if (isAppInForeground()) {
            Log.d(TAG, "App is in foreground, skipping FCM notification (SSE handles it)")
            return
        }

        showAnalysisCompletedNotification(sessionId)
    }

    private fun isAppInForeground(): Boolean =
        ProcessLifecycleOwner.get().lifecycle.currentState.isAtLeast(Lifecycle.State.STARTED)

    private fun showAnalysisCompletedNotification(sessionId: String) {
        val deepLinkIntent = Intent(
            Intent.ACTION_VIEW,
            Uri.parse("secureai://session/$sessionId"),
            this,
            MainActivity::class.java
        )

        val pendingIntent = PendingIntent.getActivity(
            this,
            sessionId.hashCode(),
            deepLinkIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, NOTIFICATION_CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_popup_reminder)
            .setContentTitle("분석 완료")
            .setContentText("보안 분석이 완료됐습니다. 결과를 확인하세요.")
            .setPriority(NotificationCompat.PRIORITY_HIGH)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build()

        val notificationManager = getSystemService(NotificationManager::class.java)
        // 알림 ID: sessionId 해시로 세션별 알림 구분
        notificationManager.notify(sessionId.hashCode(), notification)
    }

    override fun onDestroy() {
        super.onDestroy()
        serviceJob.cancel()
    }
}
