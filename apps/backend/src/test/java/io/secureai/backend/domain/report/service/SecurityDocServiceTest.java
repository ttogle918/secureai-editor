package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.service.ProjectService;
import io.secureai.backend.domain.report.dto.SecurityDocResponse;
import io.secureai.backend.domain.report.entity.DocType;
import io.secureai.backend.domain.report.entity.SecurityDocRequest;
import io.secureai.backend.domain.report.repository.SecurityDocRequestRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.service.UserService;
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
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SecurityDocServiceTest {

    @Mock SecurityDocRequestRepository securityDocRequestRepository;
    @Mock ProjectService projectService;
    @Mock UserService userService;
    @Mock SecurityDocAsyncProcessor asyncProcessor;

    @InjectMocks SecurityDocService securityDocService;

    private UUID userId;
    private UUID projectId;
    private UUID requestId;
    private User user;
    private Project project;

    @BeforeEach
    void setUp() {
        userId    = UUID.randomUUID();
        projectId = UUID.randomUUID();
        requestId = UUID.randomUUID();

        user = User.builder().build();
        ReflectionTestUtils.setField(user, "id", userId);

        project = Project.builder().name("TestProject").sourceType("GITHUB").build();
        ReflectionTestUtils.setField(project, "id", projectId);
    }

    // ── 헬퍼 ────────────────────────────────────────────────────────────────

    private SecurityDocRequest buildRequest(DocType docType, String status,
                                            String token, OffsetDateTime tokenExpires) {
        SecurityDocRequest req = SecurityDocRequest.builder()
                .project(project)
                .requestedBy(user)
                .docType(docType)
                .build();
        ReflectionTestUtils.setField(req, "id", requestId);
        ReflectionTestUtils.setField(req, "status", status);
        ReflectionTestUtils.setField(req, "downloadToken", token);
        ReflectionTestUtils.setField(req, "tokenExpiresAt", tokenExpires);
        ReflectionTestUtils.setField(req, "createdAt", OffsetDateTime.now());
        return req;
    }

    // ── TC-1: 프로젝트 멤버가 아닌 사용자 요청 → 403 PROJECT_ACCESS_DENIED ────

    @Test
    @DisplayName("createRequest — 프로젝트 멤버가 아닌 사용자는 PROJECT_ACCESS_DENIED 예외를 발생시킨다")
    void createRequest_nonMember_throwsAccessDenied() {
        when(projectService.findOrThrow(projectId)).thenReturn(project);
        when(projectService.isMember(projectId, userId)).thenReturn(false);

        assertThatThrownBy(() -> securityDocService.createRequest(projectId, userId, DocType.CISO))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED));

        verifyNoInteractions(securityDocRequestRepository, asyncProcessor);
    }

    // ── TC-2: 정상 멤버 요청 → PENDING 저장 + 비동기 트리거 ─────────────────

    @Test
    @DisplayName("createRequest — 프로젝트 멤버는 PENDING 상태로 요청이 저장된다")
    void createRequest_validMember_savesPendingRequest() {
        SecurityDocRequest saved = buildRequest(DocType.CISO, "PENDING", null, null);

        when(projectService.findOrThrow(projectId)).thenReturn(project);
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(securityDocRequestRepository.save(any(SecurityDocRequest.class))).thenReturn(saved);
        doNothing().when(asyncProcessor).process(any(UUID.class));

        SecurityDocResponse response = securityDocService.createRequest(projectId, userId, DocType.CISO);

        assertThat(response).isNotNull();
        assertThat(response.status()).isEqualTo("PENDING");
        assertThat(response.docType()).isEqualTo(DocType.CISO);
        verify(asyncProcessor).process(requestId);
    }

    // ── TC-3: 만료된 다운로드 토큰 → SECURITY_DOC_TOKEN_EXPIRED ─────────────

    @Test
    @DisplayName("download — 만료된 토큰은 SECURITY_DOC_TOKEN_EXPIRED 예외를 발생시킨다")
    void download_expiredToken_throwsTokenExpired() {
        String expiredToken = "a".repeat(64);
        SecurityDocRequest req = buildRequest(
                DocType.CISO, "COMPLETED", expiredToken,
                OffsetDateTime.now().minusHours(1));

        when(securityDocRequestRepository.findByDownloadToken(expiredToken))
                .thenReturn(Optional.of(req));

        assertThatThrownBy(() -> securityDocService.download(expiredToken))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.SECURITY_DOC_TOKEN_EXPIRED));
    }

    // ── TC-4: 존재하지 않는 토큰 → SECURITY_DOC_NOT_FOUND ───────────────────

    @Test
    @DisplayName("download — 존재하지 않는 토큰은 SECURITY_DOC_NOT_FOUND 예외를 발생시킨다")
    void download_unknownToken_throwsNotFound() {
        String unknownToken = "z".repeat(64);
        when(securityDocRequestRepository.findByDownloadToken(unknownToken))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> securityDocService.download(unknownToken))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.SECURITY_DOC_NOT_FOUND));
    }

    // ── TC-5: DocType 매핑 — HANAFOS 요청 시 올바른 docType이 저장된다 ────────

    @Test
    @DisplayName("createRequest — HANAFOS 유형 요청 시 DocType.HANAFOS가 응답에 포함된다")
    void createRequest_hanafosType_returnsHanafosDocType() {
        SecurityDocRequest saved = buildRequest(DocType.HANAFOS, "PENDING", null, null);

        when(projectService.findOrThrow(projectId)).thenReturn(project);
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(securityDocRequestRepository.save(any(SecurityDocRequest.class))).thenReturn(saved);
        doNothing().when(asyncProcessor).process(any(UUID.class));

        SecurityDocResponse response = securityDocService.createRequest(projectId, userId, DocType.HANAFOS);

        assertThat(response.docType()).isEqualTo(DocType.HANAFOS);
    }

    // ── TC-6: DocType 매핑 — ISMS 요청 시 올바른 docType이 저장된다 ──────────

    @Test
    @DisplayName("createRequest — ISMS 유형 요청 시 DocType.ISMS가 응답에 포함된다")
    void createRequest_ismsType_returnsIsmsDocType() {
        SecurityDocRequest saved = buildRequest(DocType.ISMS, "PENDING", null, null);

        when(projectService.findOrThrow(projectId)).thenReturn(project);
        when(projectService.isMember(projectId, userId)).thenReturn(true);
        when(userService.findOrThrow(userId)).thenReturn(user);
        when(securityDocRequestRepository.save(any(SecurityDocRequest.class))).thenReturn(saved);
        doNothing().when(asyncProcessor).process(any(UUID.class));

        SecurityDocResponse response = securityDocService.createRequest(projectId, userId, DocType.ISMS);

        assertThat(response.docType()).isEqualTo(DocType.ISMS);
    }

    // ── TC-7: getStatus — 타인의 요청 조회 시 SECURITY_DOC_NOT_FOUND ─────────

    @Test
    @DisplayName("getStatus — 다른 사용자의 requestId 조회는 SECURITY_DOC_NOT_FOUND 예외를 발생시킨다")
    void getStatus_otherUsersRequest_throwsNotFound() {
        UUID otherUserId = UUID.randomUUID();
        when(securityDocRequestRepository.findByIdAndRequestedById(requestId, otherUserId))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> securityDocService.getStatus(requestId, otherUserId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.SECURITY_DOC_NOT_FOUND));
    }

    // ── TC-8: getStatus — 정상 조회 ──────────────────────────────────────────

    @Test
    @DisplayName("getStatus — 본인의 요청은 SecurityDocResponse를 반환한다")
    void getStatus_ownRequest_returnsResponse() {
        SecurityDocRequest req = buildRequest(DocType.CISO, "PROCESSING", null, null);
        when(securityDocRequestRepository.findByIdAndRequestedById(requestId, userId))
                .thenReturn(Optional.of(req));

        SecurityDocResponse response = securityDocService.getStatus(requestId, userId);

        assertThat(response).isNotNull();
        assertThat(response.id()).isEqualTo(requestId);
        assertThat(response.status()).isEqualTo("PROCESSING");
        assertThat(response.docType()).isEqualTo(DocType.CISO);
    }

    // ── TC-9: download — PENDING 상태에서 다운로드 시도 → SECURITY_DOC_NOT_COMPLETED

    @Test
    @DisplayName("download — PENDING 상태 요청의 다운로드 시도는 SECURITY_DOC_NOT_COMPLETED 예외를 발생시킨다")
    void download_pendingStatus_throwsNotCompleted() {
        String token = "b".repeat(64);
        SecurityDocRequest req = buildRequest(DocType.CISO, "PENDING", token, null);

        when(securityDocRequestRepository.findByDownloadToken(token))
                .thenReturn(Optional.of(req));

        assertThatThrownBy(() -> securityDocService.download(token))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.SECURITY_DOC_NOT_COMPLETED));
    }

    // ── TC-10: COMPLETED 상태의 응답에만 downloadToken 포함 ──────────────────

    @Test
    @DisplayName("SecurityDocResponse — COMPLETED 상태일 때만 downloadToken이 포함된다")
    void securityDocResponse_onlyCompletedIncludesToken() {
        String token = "c".repeat(64);
        OffsetDateTime expiry = OffsetDateTime.now().plusHours(24);

        SecurityDocRequest completedReq = buildRequest(DocType.CISO, "COMPLETED", token, expiry);
        SecurityDocResponse completedResponse = SecurityDocResponse.from(completedReq);
        assertThat(completedResponse.downloadToken()).isEqualTo(token);

        SecurityDocRequest pendingReq = buildRequest(DocType.CISO, "PENDING", token, expiry);
        SecurityDocResponse pendingResponse = SecurityDocResponse.from(pendingReq);
        assertThat(pendingResponse.downloadToken()).isNull();
    }
}
