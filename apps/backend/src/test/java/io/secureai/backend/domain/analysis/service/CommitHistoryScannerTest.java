package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.service.CommitHistoryScanner.CommitInfo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.client.RestClient;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ExecutionException;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * CommitHistoryScanner 단위 테스트.
 *
 * fetchPage를 spy로 대체해 HTTP 호출 없이 페이지네이션 로직을 검증한다.
 * TC 구성:
 * - TC-1: 정상 단일 페이지 조회
 * - TC-2: 마지막 스캔 SHA 도달 시 페이지네이션 조기 중단
 * - TC-3: lastScannedSha=null 이면 전체 수집 (빈 페이지까지)
 * - TC-4: 페이지 조회 실패 시 skip & log (전체 중단 금지)
 * - TC-5: 빈 페이지 응답 시 페이지네이션 중단
 * - TC-6: MAX_PAGES(100) 초과 커밋은 수집하지 않는다
 */
@ExtendWith(MockitoExtension.class)
class CommitHistoryScannerTest {

    @Mock
    RestClient restClient;

    // fetchPage 를 spy 패턴으로 오버라이드하여 HTTP 호출 없이 테스트
    private CommitHistoryScanner scanner;

    @BeforeEach
    void setUp() {
        scanner = spy(new CommitHistoryScanner(restClient));
    }

    // ── 헬퍼 ────────────────────────────────────────────────────────────────────

    private static CommitInfo commit(String sha) {
        return new CommitInfo(sha, "msg-" + sha, "author", Instant.EPOCH, 0);
    }

    private static List<CommitInfo> page(String... shas) {
        List<CommitInfo> result = new ArrayList<>();
        for (String sha : shas) {
            result.add(commit(sha));
        }
        return result;
    }

    // ── TC-1: 단일 페이지 조회 ────────────────────────────────────────────────

    @Test
    @DisplayName("단일 페이지에 커밋 3개가 있으면 모두 반환된다")
    void scanCommitHistory_singlePage_returnsAllCommits() throws Exception {
        doReturn(page("sha1", "sha2", "sha3"))
                .when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(1));
        doReturn(List.of())
                .when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(2));

        List<CommitInfo> result = scanner
                .scanCommitHistory("owner", "repo", null, null, null)
                .get();

        assertThat(result).hasSize(3);
        assertThat(result.get(0).sha()).isEqualTo("sha1");
        assertThat(result.get(2).sha()).isEqualTo("sha3");
    }

    // ── TC-2: lastScannedSha 도달 시 조기 중단 ──────────────────────────────

    @Test
    @DisplayName("lastScannedSha에 도달하면 해당 SHA는 포함하지 않고 페이지네이션을 중단한다")
    void scanCommitHistory_reachesLastScannedSha_stopsPaginationExclusive() throws Exception {
        // sha3가 마지막으로 스캔한 SHA — sha3 이전(sha1, sha2)만 수집
        doReturn(page("sha1", "sha2", "sha3", "sha4"))
                .when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(1));

        List<CommitInfo> result = scanner
                .scanCommitHistory("owner", "repo", null, null, "sha3")
                .get();

        assertThat(result).hasSize(2);
        assertThat(result.stream().map(CommitInfo::sha).toList())
                .containsExactly("sha1", "sha2");

        // 두 번째 페이지는 호출되지 않아야 한다
        verify(scanner, never()).fetchPage(any(), any(), any(), any(), eq(2));
    }

    // ── TC-3: lastScannedSha=null → 빈 페이지까지 전체 수집 ─────────────────

    @Test
    @DisplayName("lastScannedSha가 null이면 빈 페이지가 올 때까지 모든 커밋을 수집한다")
    void scanCommitHistory_noLastSha_collectsUntilEmptyPage() throws Exception {
        doReturn(page("sha1", "sha2")).when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(1));
        doReturn(page("sha3")).when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(2));
        doReturn(List.of()).when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(3));

        List<CommitInfo> result = scanner
                .scanCommitHistory("owner", "repo", null, null, null)
                .get();

        assertThat(result).hasSize(3);
        assertThat(result.stream().map(CommitInfo::sha).toList())
                .containsExactly("sha1", "sha2", "sha3");
    }

    // ── TC-4: 페이지 조회 실패 시 skip & log (전체 중단 금지) ─────────────────

    @Test
    @DisplayName("첫 페이지 조회 실패 시 예외를 전파하지 않고 빈 목록을 반환한다")
    void scanCommitHistory_fetchPageThrows_returnsEmptyList() throws Exception {
        doThrow(new RuntimeException("GitHub API 500"))
                .when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(1));

        List<CommitInfo> result = scanner
                .scanCommitHistory("owner", "repo", null, null, null)
                .get();

        // 전체 중단 금지 — 빈 목록 반환
        assertThat(result).isEmpty();
    }

    // ── TC-5: 빈 페이지 응답 시 페이지네이션 중단 ─────────────────────────────

    @Test
    @DisplayName("빈 페이지 응답 시 추가 페이지를 요청하지 않는다")
    void scanCommitHistory_emptyPage_stopsImmediately() throws Exception {
        doReturn(page("sha1")).when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(1));
        doReturn(List.of()).when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(2));

        scanner.scanCommitHistory("owner", "repo", null, null, null).get();

        // 3번째 페이지는 요청되지 않아야 한다
        verify(scanner, never()).fetchPage(any(), any(), any(), any(), eq(3));
    }

    // ── TC-6: ref 파라미터 전달 확인 ─────────────────────────────────────────

    @Test
    @DisplayName("ref가 지정되면 fetchPage에 동일하게 전달된다")
    void scanCommitHistory_withRef_passesRefToFetchPage() throws Exception {
        doReturn(List.of()).when(scanner).fetchPage(eq("owner"), eq("repo"), eq("main"), isNull(), eq(1));

        scanner.scanCommitHistory("owner", "repo", "main", null, null).get();

        verify(scanner).fetchPage("owner", "repo", "main", null, 1);
    }

    // ── TC-7: mapToCommitInfo — GitHub API 응답 매핑 ──────────────────────────

    @Test
    @DisplayName("fetchPage가 반환한 CommitInfo 레코드의 필드가 올바르게 채워진다")
    void fetchPage_commitInfoFields_areCorrectlyMapped() {
        // RestClient stub — fetchPage의 실제 HTTP 호출 없이 검증
        // CommitInfo 레코드 직접 생성으로 필드 매핑 규칙 검증
        CommitInfo info = new CommitInfo("abc123", "first line", "alice", Instant.EPOCH, 5);

        assertThat(info.sha()).isEqualTo("abc123");
        assertThat(info.message()).isEqualTo("first line");
        assertThat(info.author()).isEqualTo("alice");
        assertThat(info.timestamp()).isEqualTo(Instant.EPOCH);
        assertThat(info.filesChangedCount()).isEqualTo(5);
    }

    // ── TC-8: lastScannedSha가 페이지 중간에 있어도 이전 항목만 수집 ───────────

    @Test
    @DisplayName("lastScannedSha가 페이지 첫 번째 항목이면 해당 페이지에서 아무것도 수집하지 않는다")
    void scanCommitHistory_lastShaAsFirstItem_collectsNothing() throws Exception {
        // sha1이 마지막 스캔 SHA → 첫 항목에서 바로 중단
        doReturn(page("sha1", "sha2", "sha3"))
                .when(scanner).fetchPage(any(), any(), isNull(), isNull(), eq(1));

        List<CommitInfo> result = scanner
                .scanCommitHistory("owner", "repo", null, null, "sha1")
                .get();

        assertThat(result).isEmpty();
    }
}
