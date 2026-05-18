package io.secureai.android

import app.cash.turbine.test
import io.secureai.android.sse.SseClient
import io.secureai.android.sse.SseResult
import kotlinx.coroutines.ExperimentalCoroutinesApi
import kotlinx.coroutines.test.runTest
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.After
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Before
import org.junit.Test

/**
 * SseClient 단위 테스트.
 *
 * 테스트 전략:
 * - MockWebServer로 실제 HTTP 통신 시뮬레이션 (Android SDK 의존 없음)
 * - SseClient가 Android 비의존 순수 Kotlin 클래스이므로 JVM 테스트로 가능
 */
@OptIn(ExperimentalCoroutinesApi::class)
class SseClientTest {

    private lateinit var mockWebServer: MockWebServer
    private lateinit var sseClient: SseClient
    private lateinit var baseUrl: String

    @Before
    fun setUp() {
        mockWebServer = MockWebServer()
        mockWebServer.start()
        baseUrl = mockWebServer.url("/").toString()
        sseClient = SseClient(OkHttpClient())
    }

    @After
    fun tearDown() {
        mockWebServer.shutdown()
    }

    @Test
    fun `session_completed 이벤트를 수신하면 SessionCompleted를 방출한다`() = runTest {
        val sessionId = "550e8400-e29b-41d4-a716-446655440000"
        val sseBody = buildString {
            append("event: session.completed\n")
            append("data: {\"sessionId\":\"$sessionId\"}\n")
            append("\n")
        }

        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "text/event-stream")
                .setBody(sseBody)
        )

        sseClient.observeSession(sessionId, baseUrl).test {
            val result = awaitItem()
            assertTrue("SessionCompleted를 기대하지만 $result 수신", result is SseResult.SessionCompleted)
            assertEquals(sessionId, (result as SseResult.SessionCompleted).sessionId)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `일반 이벤트는 Event 타입으로 방출된다`() = runTest {
        val sessionId = "550e8400-e29b-41d4-a716-446655440000"
        val sseBody = buildString {
            append("event: progress\n")
            append("data: {\"step\":\"sast\"}\n")
            append("\n")
        }

        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "text/event-stream")
                .setBody(sseBody)
        )

        sseClient.observeSession(sessionId, baseUrl).test {
            val result = awaitItem()
            assertTrue("Event를 기대하지만 $result 수신", result is SseResult.Event)
            val event = (result as SseResult.Event).event
            assertEquals("progress", event.type)
            assertEquals("{\"step\":\"sast\"}", event.data)
            cancelAndIgnoreRemainingEvents()
        }
    }

    @Test
    fun `스트림이 정상 종료되면 Closed를 마지막으로 방출한다`() = runTest {
        val sessionId = "550e8400-e29b-41d4-a716-446655440000"
        // 빈 응답 — 즉시 스트림 종료
        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "text/event-stream")
                .setBody("")
        )

        sseClient.observeSession(sessionId, baseUrl).test {
            val result = awaitItem()
            assertEquals(SseResult.Closed, result)
            awaitComplete()
        }
    }

    @Test
    fun `서버 오류(4xx, 5xx) 응답 시 Flow가 에러 없이 종료된다`() = runTest {
        val sessionId = "550e8400-e29b-41d4-a716-446655440000"
        mockWebServer.enqueue(
            MockResponse().setResponseCode(500)
        )

        sseClient.observeSession(sessionId, baseUrl).test {
            // 비성공 응답 시 close() 호출 — 이벤트 없이 완료됨
            awaitComplete()
        }
    }

    @Test
    fun `여러 이벤트가 순서대로 방출된다`() = runTest {
        val sessionId = "550e8400-e29b-41d4-a716-446655440000"
        val sseBody = buildString {
            append("event: progress\n")
            append("data: step1\n")
            append("\n")
            append("event: session.completed\n")
            append("data: done\n")
            append("\n")
        }

        mockWebServer.enqueue(
            MockResponse()
                .setResponseCode(200)
                .addHeader("Content-Type", "text/event-stream")
                .setBody(sseBody)
        )

        sseClient.observeSession(sessionId, baseUrl).test {
            val first = awaitItem()
            assertTrue(first is SseResult.Event)
            assertEquals("progress", (first as SseResult.Event).event.type)

            val second = awaitItem()
            assertTrue(second is SseResult.SessionCompleted)

            cancelAndIgnoreRemainingEvents()
        }
    }
}
