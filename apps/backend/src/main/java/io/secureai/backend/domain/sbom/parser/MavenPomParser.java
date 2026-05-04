package io.secureai.backend.domain.sbom.parser;

import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.NodeList;

import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

@Slf4j
@Component
public class MavenPomParser implements SbomParserStrategy {

    @Override
    public boolean supports(String fileName) {
        return "pom.xml".equalsIgnoreCase(fileName);
    }

    @Override
    public List<DependencyInfo> parse(String content) {
        List<DependencyInfo> result = new ArrayList<>();
        try {
            Document doc = buildDocument(content);
            if (doc == null) return result;

            NodeList deps = doc.getElementsByTagName("dependency");
            for (int i = 0; i < deps.getLength(); i++) {
                Element dep = (Element) deps.item(i);
                String groupId    = textOf(dep, "groupId");
                String artifactId = textOf(dep, "artifactId");
                String version    = textOf(dep, "version");
                String scope      = textOf(dep, "scope");

                if (artifactId == null) continue;
                result.add(new DependencyInfo(groupId, artifactId, version, scope, true));
            }
        } catch (Exception e) {
            log.warn("[maven-parser] pom.xml 파싱 실패: {}", e.getMessage());
        }
        return result;
    }

    private Document buildDocument(String content) {
        try {
            DocumentBuilderFactory factory = DocumentBuilderFactory.newInstance();
            factory.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            factory.setFeature("http://xml.org/sax/features/external-general-entities", false);
            factory.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            factory.setXIncludeAware(false);
            factory.setExpandEntityReferences(false);

            DocumentBuilder builder = factory.newDocumentBuilder();
            return builder.parse(new ByteArrayInputStream(content.getBytes(StandardCharsets.UTF_8)));
        } catch (Exception e) {
            log.warn("[maven-parser] XML 빌더 생성/파싱 실패 (XXE 차단 포함): {}", e.getMessage());
            return null;
        }
    }

    private String textOf(Element parent, String tag) {
        NodeList nodes = parent.getElementsByTagName(tag);
        if (nodes.getLength() == 0) return null;
        String text = nodes.item(0).getTextContent();
        return (text == null || text.isBlank()) ? null : text.trim();
    }
}
