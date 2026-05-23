package io.secureai.backend.domain.report.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.entity.Vulnerability;
import io.secureai.backend.domain.project.entity.Project;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.time.OffsetDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * CycloneDX 1.5 형식의 JSON 리포트 생성.
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class JsonReportGenerator {

    private static final DateTimeFormatter ISO_FORMATTER = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private final ObjectMapper objectMapper;

    public String generate(List<Vulnerability> vulns, Project project, AnalysisSession session) {
        try {
            ObjectNode root = buildRootNode(project, session);
            ArrayNode vulnerabilities = buildVulnerabilitiesNode(vulns);
            root.set("vulnerabilities", vulnerabilities);
            return objectMapper.writerWithDefaultPrettyPrinter().writeValueAsString(root);
        } catch (Exception e) {
            log.error("[JsonReportGenerator] JSON 생성 실패 projectId={}", project.getId(), e);
            throw new RuntimeException("JSON 리포트 생성에 실패했습니다.", e);
        }
    }

    private ObjectNode buildRootNode(Project project, AnalysisSession session) {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("bomFormat", "CycloneDX");
        root.put("specVersion", "1.5");
        root.put("version", 1);

        ObjectNode metadata = objectMapper.createObjectNode();
        metadata.put("timestamp", OffsetDateTime.now().format(ISO_FORMATTER));

        ObjectNode component = objectMapper.createObjectNode();
        component.put("name", project.getName());
        component.put("type", "application");
        if (project.getLanguage() != null) {
            component.put("language", project.getLanguage());
        }
        if (session != null) {
            component.put("sessionId", session.getId().toString());
        }
        metadata.set("component", component);
        root.set("metadata", metadata);

        return root;
    }

    private ArrayNode buildVulnerabilitiesNode(List<Vulnerability> vulns) {
        ArrayNode vulnerabilities = objectMapper.createArrayNode();
        for (Vulnerability v : vulns) {
            vulnerabilities.add(buildVulnerabilityNode(v));
        }
        return vulnerabilities;
    }

    private ObjectNode buildVulnerabilityNode(Vulnerability v) {
        ObjectNode node = objectMapper.createObjectNode();
        node.put("id", v.getId().toString());
        node.put("description", v.getDescription() != null ? v.getDescription() : "");

        ArrayNode ratings = objectMapper.createArrayNode();
        ObjectNode rating = objectMapper.createObjectNode();
        rating.put("severity", v.getSeverity().toLowerCase());
        ratings.add(rating);
        node.set("ratings", ratings);

        node.put("type", v.getVulnType());
        node.put("filePath", v.getFilePath());
        if (v.getLineNumber() != null) {
            node.put("lineNumber", v.getLineNumber());
        }
        if (v.getCwe() != null) {
            node.put("cwe", v.getCwe());
        }
        if (v.getOwasp() != null) {
            node.put("owasp", v.getOwasp());
        }
        node.put("status", v.getStatus());

        return node;
    }
}
