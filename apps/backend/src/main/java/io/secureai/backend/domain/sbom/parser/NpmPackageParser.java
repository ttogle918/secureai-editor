package io.secureai.backend.domain.sbom.parser;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;

@Slf4j
@Component
@RequiredArgsConstructor
public class NpmPackageParser implements SbomParserStrategy {

    private final ObjectMapper objectMapper;

    @Override
    public boolean supports(String fileName) {
        return "package.json".equalsIgnoreCase(fileName);
    }

    @Override
    public List<DependencyInfo> parse(String content) {
        List<DependencyInfo> result = new ArrayList<>();
        try {
            JsonNode root = objectMapper.readTree(content);
            collectDeps(result, root.path("dependencies"),    true);
            collectDeps(result, root.path("devDependencies"), false);
        } catch (Exception e) {
            log.warn("[npm-parser] package.json 파싱 실패: {}", e.getMessage());
        }
        return result;
    }

    private void collectDeps(List<DependencyInfo> result, JsonNode node, boolean isDirect) {
        if (node.isMissingNode() || !node.isObject()) return;
        Iterator<Map.Entry<String, JsonNode>> fields = node.fields();
        while (fields.hasNext()) {
            Map.Entry<String, JsonNode> entry = fields.next();
            String name    = entry.getKey();
            String version = entry.getValue().asText(null);
            result.add(new DependencyInfo(null, name, version, null, isDirect));
        }
    }
}
