package io.secureai.android.sse

import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow
import okhttp3.OkHttpClient
import okhttp3.Request
import javax.inject.Inject

/**
 * 단일 SSE 이벤트를 나타낸다.
 * @param type  SSE "event:" 필드 값 (비어있으면 빈 문자열)
 * @param data  SSE "data:" 필드 값
 */
data class SseEvent(val type: String, val data: String)

/**
 * SSE 스트림에서 방출될 수 있는 결과 타입.
 *
 * 설계 원칙:
 * - sealed interface로 상태 집합을 닫아 when 분기 안전성 보장
 */
sealed interface SseResult {
    /** 일반 이벤트 */
    data class Event(val event: SseEvent) : SseResult

    /** session.completed 이벤트 — 분석 세션 완료 */
    data class SessionCompleted(val sessionId: String) : SseResult

    /** 서버가 스트림을 정상 종료한 경우 */
    data object Closed : SseResult
}

/**
 * OkHttp 기반 SSE 스트리밍 클라이언트.
 *
 * 설계 원칙:
 * - Android SDK 의존 없는 순수 Kotlin 클래스 → 단위 테스트 가능
 * - 별도 okhttp-sse 라이브러리 없이 source.readUtf8Line() 루프로 SSE 직접 파싱
 * - SRP: SSE 파싱과 Flow 발행만 담당
 *
 * 보안 규칙:
 * - baseUrl은 호출자가 주입하며 런타임에 고정 (하드코딩 금지)
 */
class SseClient @Inject constructor(private val okHttpClient: OkHttpClient) {

    /**
     * 세션 이벤트 스트림을 구독한다.
     * Flow 수집 취소(ViewModel 종료 등)  시 HTTP call을 자동 취소한다.
     *
     * @param sessionId  구독할 세션 ID
     * @param baseUrl    백엔드 베이스 URL (예: "http://10.0.2.2:8080/")
     */
    fun observeSession(sessionId: String, baseUrl: String): Flow<SseResult> = callbackFlow {
        val request = Request.Builder()
            .url("${baseUrl}api/v1/sessions/$sessionId/events")
            .addHeader("Accept", "text/event-stream")
            .addHeader("Cache-Control", "no-cache")
            .build()

        val call = okHttpClient.newCall(request)

        val response = try {
            call.execute()
        } catch (e: Exception) {
            close(e)
            return@callbackFlow
        }

        if (!response.isSuccessful) {
            close()
            return@callbackFlow
        }

        val source = response.body?.source() ?: run {
            close()
            return@callbackFlow
        }

        try {
            var currentEventType = ""
            while (!source.exhausted()) {
                val line = source.readUtf8Line() ?: break
                when {
                    line.startsWith("event:") -> {
                        currentEventType = line.removePrefix("event:").trim()
                    }
                    line.startsWith("data:") -> {
                        val data = line.removePrefix("data:").trim()
                        if (currentEventType == "session.completed") {
                            trySend(SseResult.SessionCompleted(sessionId))
                        } else {
                            trySend(SseResult.Event(SseEvent(currentEventType, data)))
                        }
                        currentEventType = ""
                    }
                    // 빈 줄은 이벤트 구분자 — 다음 이벤트 준비
                    line.isEmpty() -> currentEventType = ""
                }
            }
        } finally {
            source.close()
            response.close()
        }

        // 서버가 스트림을 정상 종료한 경우 채널을 명시적으로 닫는다.
        // close() 없이 awaitClose만 있으면 Flow가 complete되지 않아 Turbine.awaitComplete()가 타임아웃됨.
        trySend(SseResult.Closed)
        close()
        awaitClose { call.cancel() }
    }
}
