package io.secureai.backend.domain.analysis.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.analysis.dto.ProgressSummaryResponse;
import io.secureai.backend.domain.analysis.entity.AnalysisProgressLog;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisProgressLogRepository;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.service.ProjectService;
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

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProgressLogServiceTest {

    @Mock AnalysisProgressLogRepository progressLogRepository;
    @Mock AnalysisSessionRepository sessionRepository;
    @Mock ProjectService projectService;
    @Mock ObjectMapper objectMapper;

    @InjectMocks ProgressLogService service;

    private UUID userId;
    private UUID sessionId;
    private UUID projectId;
    private AnalysisSession session;

    @BeforeEach
    void setUp() {
        userId    = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        projectId = UUID.randomUUID();

        Project project = Project.builder().name("test-project").build();
        ReflectionTestUtils.setField(project, "id", projectId);

        session = AnalysisSession.builder().project(project).build();
        ReflectionTestUtils.setField(session, "id", sessionId);
    }

    // -----------------------------------------------------------------------
    // TC-1: 정상 케이스 — 완료 2개 / 전체 4개 = 50%
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("completed 로그가 절반일 때 percentage=50 반환")
    void getSummary_calculatesPercentageCorrectly() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(progressLogRepository.findBySessionIdOrderByStepOrderAscStartedAtAsc(sessionId))
                .thenReturn(List.of(
                        log(1, "SAST 초기화", "Foo.java",  "completed", 840),
                        log(2, "SAST 분석",   "Bar.java",  "completed", 1200),
                        log(3, "SAST 분석",   "Baz.java",  "started",   null),
                        log(4, "DAST 준비",   "전체",      "started",   null)
                ));

        ProgressSummaryResponse result = service.getSummary(userId, sessionId);

        assertThat(result.total()).isEqualTo(4);
        assertThat(result.completed()).isEqualTo(2);
        assertThat(result.percentage()).isEqualTo(50);
        assertThat(result.steps()).hasSize(4);
    }

    // -----------------------------------------------------------------------
    // TC-2: 로그가 없을 때 percentage=0, 빈 steps
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("진행 로그가 없을 때 percentage=0, steps=[] 반환")
    void getSummary_returnsZeroWhenNoLogs() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(progressLogRepository.findBySessionIdOrderByStepOrderAscStartedAtAsc(sessionId))
                .thenReturn(List.of());

        ProgressSummaryResponse result = service.getSummary(userId, sessionId);

        assertThat(result.total()).isZero();
        assertThat(result.completed()).isZero();
        assertThat(result.percentage()).isZero();
        assertThat(result.steps()).isEmpty();
    }

    // -----------------------------------------------------------------------
    // TC-3: 세션을 찾지 못할 때 SESSION_NOT_FOUND 예외
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("존재하지 않는 sessionId → SESSION_NOT_FOUND 예외")
    void getSummary_throwsWhenSessionNotFound() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.getSummary(userId, sessionId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.SESSION_NOT_FOUND);

        verifyNoInteractions(progressLogRepository);
    }

    // -----------------------------------------------------------------------
    // TC-4: 프로젝트 접근 권한 없을 때 PROJECT_ACCESS_DENIED 예외
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("팀 멤버가 아닌 userId → PROJECT_ACCESS_DENIED 예외")
    void getSummary_throwsWhenNoProjectAccess() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(projectService.isMember(projectId, userId)).thenReturn(false);

        assertThatThrownBy(() -> service.getSummary(userId, sessionId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED);

        verifyNoInteractions(progressLogRepository);
    }

    // -----------------------------------------------------------------------
    // TC-5: DTO 필드 매핑 확인 — stepName/stepOrder/target/status/durationMs
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("ProgressStepDto 필드가 엔티티와 동일하게 매핑됨")
    void getSummary_mapsStepDtoFieldsCorrectly() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(progressLogRepository.findBySessionIdOrderByStepOrderAscStartedAtAsc(sessionId))
                .thenReturn(List.of(log(2, "SAST 분석", "Auth.java", "completed", 950)));

        ProgressSummaryResponse result = service.getSummary(userId, sessionId);

        ProgressSummaryResponse.ProgressStepDto step = result.steps().get(0);
        assertThat(step.stepName()).isEqualTo("SAST 분석");
        assertThat(step.stepOrder()).isEqualTo(2);
        assertThat(step.target()).isEqualTo("Auth.java");
        assertThat(step.status()).isEqualTo("completed");
        assertThat(step.durationMs()).isEqualTo(950);
    }

    // -----------------------------------------------------------------------
    // 헬퍼
    // -----------------------------------------------------------------------

    private AnalysisProgressLog log(int order, String name, String target, String status, Integer durationMs) {
        return AnalysisProgressLog.builder()
                .stepOrder(order)
                .stepName(name)
                .target(target)
                .status(status)
                .startedAt(OffsetDateTime.now())
                .durationMs(durationMs)
                .build();
    }
}
