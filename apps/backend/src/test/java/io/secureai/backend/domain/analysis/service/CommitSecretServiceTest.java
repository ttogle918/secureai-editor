package io.secureai.backend.domain.analysis.service;

import io.secureai.backend.domain.analysis.dto.CommitScanRequest;
import io.secureai.backend.domain.analysis.dto.CommitScanResponse;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.analysis.repository.VulnerabilityRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
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
import org.springframework.web.client.RestClient;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CommitSecretServiceTest {

    @Mock AnalysisSessionRepository sessionRepository;
    @Mock VulnerabilityRepository vulnerabilityRepository;
    @Mock TeamMemberRepository teamMemberRepository;

    @InjectMocks CommitSecretService service;

    private UUID userId;
    private UUID sessionId;
    private UUID projectId;
    private AnalysisSession session;
    private Project project;

    @BeforeEach
    void setUp() {
        userId    = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        projectId = UUID.randomUUID();

        project = Project.builder().name("test-project").build();
        ReflectionTestUtils.setField(project, "id", projectId);

        session = AnalysisSession.builder().project(project).build();
        ReflectionTestUtils.setField(session, "id", sessionId);

        // agentRestClient를 mock RestClient로 교체해 실제 네트워크 호출 방지
        RestClient mockRestClient = mock(RestClient.class);
        ReflectionTestUtils.setField(service, "agentRestClient", mockRestClient);
        ReflectionTestUtils.setField(service, "internalApiKey", "test-internal-key");

        // RestClient 체이닝 mock 설정
        RestClient.RequestBodyUriSpec uriSpec = mock(RestClient.RequestBodyUriSpec.class);
        RestClient.RequestBodySpec bodySpec = mock(RestClient.RequestBodySpec.class);
        RestClient.ResponseSpec responseSpec = mock(RestClient.ResponseSpec.class);

        when(mockRestClient.post()).thenReturn(uriSpec);
        when(uriSpec.uri(anyString())).thenReturn(bodySpec);
        when(bodySpec.contentType(any())).thenReturn(bodySpec);
        when(bodySpec.header(anyString(), anyString())).thenReturn(bodySpec);
        when(bodySpec.body(any())).thenReturn(bodySpec);
        when(bodySpec.retrieve()).thenReturn(responseSpec);
        when(responseSpec.toBodilessEntity()).thenReturn(null);
    }

    // ── TC-1: 존재하지 않는 세션 → SESSION_NOT_FOUND 예외 ────────────────────

    @Test
    @DisplayName("존재하지 않는 세션 ID로 스캔 요청 시 SESSION_NOT_FOUND 예외를 던진다")
    void triggerScan_unknownSession_throwsSessionNotFound() {
        UUID unknownSessionId = UUID.randomUUID();
        when(sessionRepository.findById(unknownSessionId)).thenReturn(Optional.empty());

        CommitScanRequest req = new CommitScanRequest("owner", "repo", null, 30, null, null);

        assertThatThrownBy(() -> service.triggerScan(userId, unknownSessionId, req, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }

    // ── TC-2: 팀 멤버가 아닌 사용자 → PROJECT_ACCESS_DENIED 예외 ───────────

    @Test
    @DisplayName("프로젝트 멤버가 아닌 사용자가 스캔 요청 시 PROJECT_ACCESS_DENIED 예외를 던진다")
    void triggerScan_nonMemberUser_throwsAccessDenied() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(false);

        CommitScanRequest req = new CommitScanRequest("owner", "repo", null, 30, null, null);

        assertThatThrownBy(() -> service.triggerScan(userId, sessionId, req, null))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED));
    }

    // ── TC-3: 정상 스캔 트리거 → AI Engine 호출 + 시크릿 수 반환 ────────────

    @Test
    @DisplayName("유효한 멤버가 스캔 요청 시 accepted 상태와 현재 시크릿 수를 반환한다")
    void triggerScan_validMember_returnsAcceptedWithSecretCount() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(vulnerabilityRepository.countBySessionIdAndVulnType(sessionId, "SECRET_EXPOSURE")).thenReturn(3L);

        CommitScanRequest req = new CommitScanRequest("octocat", "hello-world", "main", 30, null, null);

        CommitScanResponse response = service.triggerScan(userId, sessionId, req, "ghp_test_token");

        assertThat(response.sessionId()).isEqualTo(sessionId);
        assertThat(response.status()).isEqualTo("accepted");
        assertThat(response.secretCount()).isEqualTo(3);
    }

    // ── TC-4: countSecrets — 멤버 아닌 사용자 → 접근 거부 ───────────────────

    @Test
    @DisplayName("countSecrets 호출 시 멤버가 아닌 사용자는 PROJECT_ACCESS_DENIED를 던진다")
    void countSecrets_nonMember_throwsAccessDenied() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(false);

        assertThatThrownBy(() -> service.countSecrets(userId, sessionId))
                .isInstanceOf(BusinessException.class)
                .satisfies(e -> assertThat(((BusinessException) e).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED));
    }

    // ── TC-5: countSecrets — 정상 조회 ───────────────────────────────────────

    @Test
    @DisplayName("countSecrets 호출 시 SECRET_EXPOSURE 유형 취약점 수를 반환한다")
    void countSecrets_validMember_returnsCount() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(vulnerabilityRepository.countBySessionIdAndVulnType(sessionId, "SECRET_EXPOSURE")).thenReturn(7L);

        long count = service.countSecrets(userId, sessionId);

        assertThat(count).isEqualTo(7L);
    }

    // ── TC-6: AI Engine 호출 실패 시 error 상태 반환 (전체 세션 중단 금지) ───

    @Test
    @DisplayName("AI Engine 호출이 실패해도 error 상태를 반환하고 예외를 전파하지 않는다")
    void triggerScan_agentCallFails_returnsErrorStatus() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(vulnerabilityRepository.countBySessionIdAndVulnType(sessionId, "SECRET_EXPOSURE")).thenReturn(0L);

        // RestClient 체이닝을 예외 발생하도록 재설정
        RestClient mockRestClient = mock(RestClient.class);
        ReflectionTestUtils.setField(service, "agentRestClient", mockRestClient);
        when(mockRestClient.post()).thenThrow(new org.springframework.web.client.RestClientException("connection refused"));

        CommitScanRequest req = new CommitScanRequest("owner", "repo", null, 30, null, null);

        // 예외가 전파되지 않고 error 상태를 반환해야 한다
        CommitScanResponse response = service.triggerScan(userId, sessionId, req, null);

        assertThat(response.status()).isEqualTo("error");
        assertThat(response.secretCount()).isZero();
    }
}
