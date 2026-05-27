package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.analysis.repository.VulnerabilityRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

/**
 * RoiCalculationService 단위 테스트.
 * 외부 의존성(Repository)은 Mockito로 격리한다.
 */
@ExtendWith(MockitoExtension.class)
class RoiCalculationServiceTest {

    @Mock
    private AnalysisSessionRepository sessionRepository;

    @Mock
    private VulnerabilityRepository vulnerabilityRepository;

    @InjectMocks
    private RoiCalculationService roiCalculationService;

    private UUID sessionId;
    private UUID projectId;
    private AnalysisSession session;
    private Project project;

    @BeforeEach
    void setUp() {
        sessionId = UUID.randomUUID();
        projectId = UUID.randomUUID();

        project = Project.builder().name("TestProject").sourceType("GITHUB").build();
        ReflectionTestUtils.setField(project, "id", projectId);

        session = AnalysisSession.builder().project(project).build();
        ReflectionTestUtils.setField(session, "id", sessionId);
    }

    // -----------------------------------------------------------------------
    // TC-1: calculateRoi — 기본 단가($50), 취약점 10건 → 절감 비용 $2000
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("calculateRoi_기본단가_정상계산 — 취약점 10개 × 4h × $50 = $2000")
    void calculateRoi_기본단가_정상계산() {
        // given
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "CRITICAL")).thenReturn(3L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "HIGH")).thenReturn(4L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "MEDIUM")).thenReturn(2L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "LOW")).thenReturn(1L);

        // when
        RoiCalculationService.RoiResult result =
                roiCalculationService.calculateRoi(sessionId, 50.0);

        // then
        assertThat(result).isNotNull();
        assertThat(result.totalVulnCount()).isEqualTo(10L);
        assertThat(result.savedHours()).isEqualTo(40.0);     // 10 × 4h
        assertThat(result.savedCost()).isEqualTo(2000.0);    // 40h × $50
        assertThat(result.hourlyRate()).isEqualTo(50.0);
        assertThat(result.criticalCount()).isEqualTo(3L);
        assertThat(result.highCount()).isEqualTo(4L);
        assertThat(result.mediumCount()).isEqualTo(2L);
        assertThat(result.lowCount()).isEqualTo(1L);
        assertThat(result.projectName()).isEqualTo("TestProject");
    }

    // -----------------------------------------------------------------------
    // TC-2: calculateRoi — 커스텀 단가($100), 취약점 5건
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("calculateRoi_커스텀단가_정상계산 — 취약점 5건 × 4h × $100 = $2000")
    void calculateRoi_커스텀단가_정상계산() {
        // given
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "CRITICAL")).thenReturn(2L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "HIGH")).thenReturn(2L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "MEDIUM")).thenReturn(1L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "LOW")).thenReturn(0L);

        // when
        RoiCalculationService.RoiResult result =
                roiCalculationService.calculateRoi(sessionId, 100.0);

        // then
        assertThat(result.totalVulnCount()).isEqualTo(5L);
        assertThat(result.savedHours()).isEqualTo(20.0);     // 5 × 4h
        assertThat(result.savedCost()).isEqualTo(2000.0);    // 20h × $100
        assertThat(result.hourlyRate()).isEqualTo(100.0);
    }

    // -----------------------------------------------------------------------
    // TC-3: calculateRoi — 취약점 0건 → 절감 시간/비용 모두 0
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("calculateRoi_취약점없음_0반환 — 취약점 0건 시 savedHours=0, savedCost=0")
    void calculateRoi_취약점없음_0반환() {
        // given
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "CRITICAL")).thenReturn(0L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "HIGH")).thenReturn(0L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "MEDIUM")).thenReturn(0L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "LOW")).thenReturn(0L);

        // when
        RoiCalculationService.RoiResult result =
                roiCalculationService.calculateRoi(sessionId, 50.0);

        // then
        assertThat(result.totalVulnCount()).isZero();
        assertThat(result.savedHours()).isZero();
        assertThat(result.savedCost()).isZero();
    }

    // -----------------------------------------------------------------------
    // TC-4: calculateRoi — 세션 없으면 SESSION_NOT_FOUND 예외
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("calculateRoi_세션없음_SESSION_NOT_FOUND — 존재하지 않는 세션 ID는 예외를 발생시킨다")
    void calculateRoi_세션없음_SESSION_NOT_FOUND() {
        // given
        UUID unknownSessionId = UUID.randomUUID();
        when(sessionRepository.findById(unknownSessionId)).thenReturn(Optional.empty());

        // when / then
        assertThatThrownBy(() -> roiCalculationService.calculateRoi(unknownSessionId, 50.0))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex ->
                        assertThat(((BusinessException) ex).getErrorCode())
                                .isEqualTo(ErrorCode.SESSION_NOT_FOUND));

        verifyNoInteractions(vulnerabilityRepository);
    }

    // -----------------------------------------------------------------------
    // TC-5: calculateRoi — hourlyRate <= 0 이면 기본값 50.0으로 대체
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("calculateRoi_단가0이하_기본값사용 — hourlyRate가 0 이하이면 DEFAULT_HOURLY_RATE를 적용한다")
    void calculateRoi_단가0이하_기본값사용() {
        // given
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "CRITICAL")).thenReturn(1L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "HIGH")).thenReturn(0L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "MEDIUM")).thenReturn(0L);
        when(vulnerabilityRepository.countBySeverityForSession(sessionId, "LOW")).thenReturn(0L);

        // when — hourlyRate = -1 → 기본값 50.0 적용
        RoiCalculationService.RoiResult result =
                roiCalculationService.calculateRoi(sessionId, -1.0);

        // then
        assertThat(result.hourlyRate()).isEqualTo(RoiCalculationService.DEFAULT_HOURLY_RATE);
        assertThat(result.savedCost()).isEqualTo(4.0 * 50.0);  // 1 vuln × 4h × $50
    }
}
