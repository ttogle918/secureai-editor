package io.secureai.backend.domain.sbom.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.cve.repository.CveDataRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
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
    private final CveDataRepository cveDataRepository;

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
        List<DependencyComponent> components = componentRepository.findBySessionId(sessionId);
        int matchCount = 0;
        for (DependencyComponent comp : components) {
            long count = cveDataRepository.findBySeverityOrderByPublishedAtDesc("HIGH",
                    org.springframework.data.domain.Pageable.unpaged())
                    .stream()
                    .filter(cve -> cve.getAffectedProducts().contains(comp.getArtifactId()))
                    .count();
            if (count > 0) {
                log.info("[sbom-cve] 매칭 발견 sessionId={} artifact={} cveCount={}",
                        sessionId, comp.getArtifactId(), count);
                matchCount += count;
            }
        }
        log.info("[sbom-cve] CVE 매칭 완료 sessionId={} totalMatches={}", sessionId, matchCount);
        return matchCount;
    }

    private String resolvePackageManager(String fileName) {
        return switch (fileName.toLowerCase()) {
            case "pom.xml"           -> "maven";
            case "package.json"      -> "npm";
            case "requirements.txt"  -> "pip";
            case "cargo.toml"        -> "cargo";
            default                  -> "unknown";
        };
    }
}
