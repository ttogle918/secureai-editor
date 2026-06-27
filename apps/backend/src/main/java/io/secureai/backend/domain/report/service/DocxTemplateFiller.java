package io.secureai.backend.domain.report.service;

import com.deepoove.poi.XWPFTemplate;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

import java.io.FileOutputStream;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.Map;

@Slf4j
@Component
public class DocxTemplateFiller {

    public void fillTemplate(InputStream templateStream, Map<String, Object> data, String outputPath) {
        try (OutputStream out = new FileOutputStream(outputPath)) {
            XWPFTemplate template = XWPFTemplate.compile(templateStream).render(data);
            template.write(out);
            template.close();
            log.info("[DocxTemplateFiller] DOCX 템플릿 처리 완료: {}", outputPath);
        } catch (Exception e) {
            log.error("[DocxTemplateFiller] DOCX 생성 실패", e);
            throw new RuntimeException("DOCX 템플릿 생성 중 오류가 발생했습니다.", e);
        }
    }
}
