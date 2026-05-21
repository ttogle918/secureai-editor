package io.secureai.backend.domain.sbom.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.cve.service.CveSearchService;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.sbom.dto.SaveComponentsRequest;
import io.secureai.backend.domain.sbom.dto.SbomComponentResponse;
import io.secureai.backend.domain.sbom.entity.DependencyComponent;
import io.secureai.backend.domain.sbom.parser.DependencyInfo;
import io.secureai.backend.domain.sbom.parser.SbomParserFactory;
import io.secureai.backend.domain.sbom.parser.SbomParserStrategy;
import io.secureai.backend.domain.sbom.repository.DependencyComponentRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class SbomService {

    private final SbomParserFactory parserFactory;
    private final DependencyComponentRepository componentRepository;
    private final AnalysisSessionRepository sessionRepository;
    private final ProjectRepository projectRepository;
    private final TeamMemberRepository teamMemberRepository;
    // cve 도메인 Repository 직접 주입 금지 — Service를 통해 접근 (도메인 격리 원칙)
    private final CveSearchService cveSearchService;

    @Transactional
    public int parseAndSave(UUID sessionId, UUID projectId, String fileName, String content) {
        AnalysisSession session = sessionRepository.findById(sessionId)
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));
        Project project = projectRepository.findById(projectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_NOT_FOUND));

        Optional<SbomParserStrategy> parserOpt = parserFactory.getParser(fileName);
        if (parserOpt.isEmpty()) {
            log.warn("[sbom] 지원하지 않는 파일: {}", fileName);
            return 0;
        }

        List<DependencyInfo> infos = parserOpt.get().parse(content);
        if (infos.isEmpty()) return 0;

        List<DependencyComponent> components = infos.stream()
                .map(info -> DependencyComponent.builder()
                        .session(session)
                        .project(project)
                        .packageManager(resolvePackageManager(fileName))
                        .groupId(info.groupId())
                        .artifactId(info.artifactId())
                        .version(info.version())
                        .scope(info.scope())
                        .isDirect(info.isDirect())
                        .build())
                .toList();

        componentRepository.saveAll(components);
        log.info("[sbom] 저장 완료 sessionId={} file={} count={}", sessionId, fileName, components.size());
        return components.size();
    }

    @Transactional(readOnly = true)
    public int matchCve(UUID sessionId) {
        List<DependencyComponent> components = componentRepository.findBySession_Id(sessionId);
        int matchCount = 0;
        for (DependencyComponent comp : components) {
            // cve 도메인 Repository 직접 호출 금지 — CveSearchService 위임
            int count = cveSearchService.search(comp.getArtifactId(), null).size();
            if (count > 0) {
                log.info("[sbom-cve] 매칭 발견 sessionId={} artifact={} cveCount={}",
                        sessionId, comp.getArtifactId(), count);
                matchCount += count;
            }
        }
        log.info("[sbom-cve] CVE 매칭 완료 sessionId={} totalMatches={}", sessionId, matchCount);
        return matchCount;
    }

    /**
     * AI Engine 이 파싱한 컴포넌트 목록을 저장한다.
     *
     * ecosystem 을 packageManager 컬럼에 저장하고,
     * artifactId 에 컴포넌트 이름 전체(group:artifact 형태 포함)를 저장한다.
     *
     * @return 저장된 컴포넌트 수
     */
    @Transactional
    public int saveComponents(SaveComponentsRequest request) {
        AnalysisSession session = sessionRepository.findById(request.sessionId())
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));
        Project project = projectRepository.findById(request.projectId())
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_NOT_FOUND));

        if (request.components() == null || request.components().isEmpty()) {
            return 0;
        }

        List<DependencyComponent> components = request.components().stream()
                .map(item -> {
                    String[] parts = item.name().split(":", 2);
                    String groupId   = parts.length == 2 ? parts[0] : null;
                    String artifactId = parts.length == 2 ? parts[1] : item.name();

                    return DependencyComponent.builder()
                            .session(session)
                            .project(project)
                            .packageManager(item.ecosystem())
                            .groupId(groupId)
                            .artifactId(artifactId)
                            .version(item.version())
                            .isDirect(true)
                            .build();
                })
                .toList();

        componentRepository.saveAll(components);
        log.info("[sbom] saveComponents sessionId={} count={}", request.sessionId(), components.size());
        return components.size();
    }

    /**
     * 특정 세션의 SBOM 컴포넌트 목록을 조회한다.
     *
     * <p>프로젝트 접근 권한(팀 멤버 여부)을 검증한 후 컴포넌트를 반환한다.
     *
     * @param projectId 프로젝트 ID
     * @param sessionId 분석 세션 ID
     * @param userId    요청자 ID (@AuthenticationPrincipal에서 획득)
     * @return SBOM 컴포넌트 응답 목록 (세션에 컴포넌트가 없으면 빈 리스트)
     */
    @Transactional(readOnly = true)
    public List<SbomComponentResponse> getComponents(UUID projectId, UUID sessionId, UUID userId) {
        verifyProjectAccess(projectId, userId);
        return componentRepository.findBySession_Id(sessionId).stream()
                .map(SbomComponentResponse::from)
                .toList();
    }

    private void verifyProjectAccess(UUID projectId, UUID userId) {
        projectRepository.findById(projectId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PROJECT_NOT_FOUND));
        if (!teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)) {
            throw new BusinessException(ErrorCode.PROJECT_ACCESS_DENIED);
        }
    }

    private String resolvePackageManager(String fileName) {
        return switch (fileName.toLowerCase()) {
            case "pom.xml"           -> "maven";
            case "package.json"      -> "npm";
            case "requirements.txt"  -> "pip";
            case "cargo.toml"        -> "cargo";
            case "go.mod"            -> "go";
            default                  -> "unknown";
        };
    }
}
