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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.UUID;

/**
 * 보안 문서 생성 서비스 — 소유권 검증, 요청 저장, 비동기 처리 위임을 담당한다.
 * PDF 변환 등 무거운 작업은 SecurityDocAsyncProcessor에 위임한다 (SRP).
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class SecurityDocService {

    private static final Path SEC_DOC_BASE_DIR =
            Paths.get(System.getProperty("java.io.tmpdir"), "secureai", "security-docs")
                    .toAbsolutePath().normalize();

    private final SecurityDocRequestRepository securityDocRequestRepository;
    private final ProjectService projectService;
    private final UserService userService;
    private final SecurityDocAsyncProcessor asyncProcessor;

    /**
     * 보안 문서 생성 요청 — PENDING 상태로 저장 후 비동기 처리 트리거.
     * 프로젝트 소유권 검증: 팀 멤버인지 확인.
     */
    @Transactional
    public SecurityDocResponse createRequest(UUID projectId, UUID userId, DocType docType, String version) {
        Project project = projectService.findOrThrow(projectId);
        verifyProjectMembership(projectId, userId);
        User user = userService.findOrThrow(userId);

        SecurityDocRequest req = SecurityDocRequest.builder()
                .project(project)
                .requestedBy(user)
                .docType(docType)
                .frameworkVersion(version)
                .build();
        SecurityDocRequest saved = securityDocRequestRepository.save(req);

        // 커밋 완료 후 async 트리거 — 커밋 전 실행 시 @Async 스레드의 findById가 아직
        // 커밋되지 않은 행을 못 찾아("요청을 찾을 수 없음") 상태가 PENDING에 갇힌다.
        // 트랜잭션 동기화가 없는 경우(트랜잭션 밖 호출·단위 테스트)에는 즉시 실행한다.
        UUID requestId = saved.getId();
        if (TransactionSynchronizationManager.isSynchronizationActive()) {
            TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                @Override
                public void afterCommit() {
                    asyncProcessor.process(requestId);
                }
            });
        } else {
            asyncProcessor.process(requestId);
        }
        log.info("[SecurityDocService] 보안 문서 생성 요청 requestId={} docType={} projectId={}",
                saved.getId(), docType, projectId);
        return SecurityDocResponse.from(saved);
    }

    /**
     * 보안 문서 생성 상태 조회 — 요청자 본인인지 검증.
     */
    @Transactional(readOnly = true)
    public SecurityDocResponse getStatus(UUID requestId, UUID userId) {
        SecurityDocRequest req = securityDocRequestRepository
                .findByIdAndRequestedById(requestId, userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SECURITY_DOC_NOT_FOUND));
        return SecurityDocResponse.from(req);
    }

    /**
     * 다운로드 토큰으로 PDF 파일 다운로드.
     * 보안: 토큰 자체가 인증 수단 — 별도 사용자 인증 불필요하나 토큰 만료 반드시 검사.
     */
    @Transactional(readOnly = true)
    public DownloadResult download(String downloadToken) {
        SecurityDocRequest req = securityDocRequestRepository
                .findByDownloadToken(downloadToken)
                .orElseThrow(() -> new BusinessException(ErrorCode.SECURITY_DOC_NOT_FOUND));

        if (!"COMPLETED".equals(req.getStatus())) {
            throw new BusinessException(ErrorCode.SECURITY_DOC_NOT_COMPLETED);
        }
        if (req.isTokenExpired()) {
            throw new BusinessException(ErrorCode.SECURITY_DOC_TOKEN_EXPIRED);
        }

        return readFileAsResource(req);
    }

    // ── 내부 헬퍼 ────────────────────────────────────────────────────────────

    private void verifyProjectMembership(UUID projectId, UUID userId) {
        if (!projectService.isMember(projectId, userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }
    }

    private DownloadResult readFileAsResource(SecurityDocRequest req) {
        try {
            Path filePath = Paths.get(req.getFilePath()).toAbsolutePath().normalize();
            // DB에 저장된 경로라도 허용된 디렉토리 하위인지 검증 (Path Traversal 방어)
            if (!filePath.startsWith(SEC_DOC_BASE_DIR)) {
                log.warn("[SecurityDocService] 허용되지 않은 경로 접근 requestId={}", req.getId());
                throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "파일을 읽을 수 없습니다.");
            }
            byte[] content = Files.readAllBytes(filePath);
            String fileName = req.getDocType().name().toLowerCase()
                    + "-" + req.getId() + ".pdf";
            return new DownloadResult(new ByteArrayResource(content), "application/pdf", fileName);
        } catch (IOException e) {
            log.error("[SecurityDocService] 파일 읽기 실패 requestId={}", req.getId(), e);
            throw new BusinessException(ErrorCode.INTERNAL_SERVER_ERROR, "파일을 읽을 수 없습니다.");
        }
    }

    public record DownloadResult(Resource resource, String contentType, String fileName) {}
}
