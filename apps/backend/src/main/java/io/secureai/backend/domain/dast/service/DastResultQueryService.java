package io.secureai.backend.domain.dast.service;

import io.secureai.backend.domain.dast.entity.ExploitResult;
import io.secureai.backend.domain.dast.entity.ScanStatus;
import io.secureai.backend.domain.dast.repository.ExploitResultRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;

/**
 * DAST 결과 조회 전용 서비스 (CQRS Query).
 * DastExecutionService(Command)와 책임을 분리한다.
 */
@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class DastResultQueryService {

    private final ExploitResultRepository exploitResultRepository;

    public List<ExploitResult> getResultsBySessionId(UUID sessionId) {
        return exploitResultRepository.findBySessionId(sessionId);
    }

    public Optional<ExploitResult> getLatestResultByVulnId(UUID vulnId) {
        return exploitResultRepository.findTopByVulnIdOrderByExecutedAtDesc(vulnId);
    }

    /**
     * vulnId 목록으로 각 취약점의 최신 완료 결과를 일괄 조회한다.
     * 세션 ID와 독립적이므로 새로고침 후에도 결과 복원 가능.
     */
    public List<ExploitResult> getLatestCompletedByVulnIds(List<UUID> vulnIds) {
        if (vulnIds.isEmpty()) return List.of();
        List<ScanStatus> completed = List.of(ScanStatus.SUCCESS, ScanStatus.FAILED);
        List<ExploitResult> all = exploitResultRepository.findCompletedByVulnIdIn(vulnIds, completed);
        Map<UUID, ExploitResult> latestPerVuln = new LinkedHashMap<>();
        for (ExploitResult e : all) {
            latestPerVuln.putIfAbsent(e.getVulnId(), e);
        }
        return new ArrayList<>(latestPerVuln.values());
    }
}
