package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.analysis.repository.VulnerabilityRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/**
 * ROI(Return on Investment) 계산 서비스.
 * SRP: 취약점 절감 비용 계산 책임만 담당.
 *
 * <p>공식:
 * <pre>
 *   savedHours = totalVulnCount × 4.0  (취약점 1건당 평균 4시간)
 *   savedCost  = savedHours × hourlyRate
 * </pre>
 */
@Service
@RequiredArgsConstructor
public class RoiCalculationService {

    /** 기본 시간당 단가 (USD) */
    public static final double DEFAULT_HOURLY_RATE = 50.0;

    /** 취약점 1건당 수동 처리에 필요한 평균 시간 (시간 단위) */
    private static final double HOURS_PER_VULNERABILITY = 4.0;

    private final AnalysisSessionRepository sessionRepository;
    private final VulnerabilityRepository vulnerabilityRepository;

    /**
     * 세션 기준 ROI를 계산한다.
     *
     * @param sessionId  분석 세션 ID
     * @param hourlyRate 시간당 단가 (0 이하이면 DEFAULT_HOURLY_RATE 사용)
     * @return ROI 계산 결과 레코드
     * @throws BusinessException SESSION_NOT_FOUND — 세션이 존재하지 않을 때
     */
    @Transactional(readOnly = true)
    public RoiResult calculateRoi(UUID sessionId, double hourlyRate) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));

        double effectiveRate = hourlyRate > 0 ? hourlyRate : DEFAULT_HOURLY_RATE;

        long criticalCount = vulnerabilityRepository.countBySeverityForSession(sessionId, "CRITICAL");
        long highCount     = vulnerabilityRepository.countBySeverityForSession(sessionId, "HIGH");
        long mediumCount   = vulnerabilityRepository.countBySeverityForSession(sessionId, "MEDIUM");
        long lowCount      = vulnerabilityRepository.countBySeverityForSession(sessionId, "LOW");
        long totalVulnCount = criticalCount + highCount + mediumCount + lowCount;

        double savedHours = totalVulnCount * HOURS_PER_VULNERABILITY;
        double savedCost  = savedHours * effectiveRate;

        return new RoiResult(
                session.getProject().getName(),
                criticalCount,
                highCount,
                mediumCount,
                lowCount,
                totalVulnCount,
                savedHours,
                savedCost,
                effectiveRate
        );
    }

    /**
     * ROI 계산 결과.
     *
     * @param projectName    프로젝트 이름
     * @param criticalCount  CRITICAL 심각도 취약점 수
     * @param highCount      HIGH 심각도 취약점 수
     * @param mediumCount    MEDIUM 심각도 취약점 수
     * @param lowCount       LOW 심각도 취약점 수
     * @param totalVulnCount 전체 취약점 수 (4가지 심각도 합계)
     * @param savedHours     절감 예상 시간 (시간 단위)
     * @param savedCost      절감 예상 비용 (hourlyRate 통화 기준)
     * @param hourlyRate     적용된 시간당 단가
     */
    public record RoiResult(
            String projectName,
            long criticalCount,
            long highCount,
            long mediumCount,
            long lowCount,
            long totalVulnCount,
            double savedHours,
            double savedCost,
            double hourlyRate
    ) {}
}
