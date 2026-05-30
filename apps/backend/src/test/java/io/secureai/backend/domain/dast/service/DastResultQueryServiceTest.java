package io.secureai.backend.domain.dast.service;

import io.secureai.backend.domain.dast.entity.ExploitResult;
import io.secureai.backend.domain.dast.entity.ScanStatus;
import io.secureai.backend.domain.dast.repository.ExploitResultRepository;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DastResultQueryServiceTest {

    @Mock
    private ExploitResultRepository exploitResultRepository;

    @InjectMocks
    private DastResultQueryService service;

    private ExploitResult result(UUID vulnId, String marker) {
        return ExploitResult.builder()
                .sessionId(UUID.randomUUID())
                .vulnId(vulnId)
                .vulnType(marker)
                .build();
    }

    @Test
    @DisplayName("getResultsBySessionId — 리포지토리에 위임한다")
    void getResultsBySessionId_delegates() {
        UUID sessionId = UUID.randomUUID();
        List<ExploitResult> expected = List.of(result(UUID.randomUUID(), "x"));
        when(exploitResultRepository.findBySessionId(sessionId)).thenReturn(expected);

        assertThat(service.getResultsBySessionId(sessionId)).isSameAs(expected);
    }

    @Test
    @DisplayName("getLatestResultByVulnId — 리포지토리에 위임한다")
    void getLatestResultByVulnId_delegates() {
        UUID vulnId = UUID.randomUUID();
        Optional<ExploitResult> expected = Optional.of(result(vulnId, "x"));
        when(exploitResultRepository.findTopByVulnIdOrderByExecutedAtDesc(vulnId)).thenReturn(expected);

        assertThat(service.getLatestResultByVulnId(vulnId)).isSameAs(expected);
    }

    @Test
    @DisplayName("getLatestCompletedByVulnIds — 빈 입력이면 조회 없이 빈 목록을 반환한다")
    void getLatestCompletedByVulnIds_empty_returnsEmptyWithoutQuery() {
        assertThat(service.getLatestCompletedByVulnIds(List.of())).isEmpty();
        verifyNoInteractions(exploitResultRepository);
    }

    @Test
    @DisplayName("getLatestCompletedByVulnIds — vulnId별 첫 결과만 남기고(=최신), SUCCESS/FAILED만 조회한다")
    void getLatestCompletedByVulnIds_dedupesKeepingFirstPerVuln() {
        UUID vulnA = UUID.randomUUID();
        UUID vulnB = UUID.randomUUID();
        ExploitResult aLatest = result(vulnA, "a-latest");
        ExploitResult aOld    = result(vulnA, "a-old");
        ExploitResult bLatest = result(vulnB, "b-latest");
        // 리포지토리는 executedAt DESC로 정렬해 반환한다고 가정 → 각 vuln의 첫 행이 최신
        when(exploitResultRepository.findCompletedByVulnIdIn(any(), any()))
                .thenReturn(List.of(aLatest, aOld, bLatest));

        List<ExploitResult> result =
                service.getLatestCompletedByVulnIds(List.of(vulnA, vulnB));

        assertThat(result).containsExactly(aLatest, bLatest);

        // 완료 상태 필터(SUCCESS, FAILED)로 조회했는지 검증
        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<ScanStatus>> statusCaptor = ArgumentCaptor.forClass(List.class);
        verify(exploitResultRepository).findCompletedByVulnIdIn(
                eq(List.of(vulnA, vulnB)), statusCaptor.capture());
        assertThat(statusCaptor.getValue())
                .containsExactlyInAnyOrder(ScanStatus.SUCCESS, ScanStatus.FAILED);
        verify(exploitResultRepository, never()).findBySessionId(any());
    }
}
