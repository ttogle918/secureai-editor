package io.secureai.backend.domain.compliance.crawler;

import lombok.extern.slf4j.Slf4j;
import org.apache.pdfbox.Loader;
import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.text.PDFTextStripper;
import org.springframework.stereotype.Component;

/**
 * PDFBox 3.x 기반 PDF 텍스트 추출기.
 *
 * <p>PDFBox 3.x 에서는 {@code PDDocument.load()} 대신 {@code Loader.loadPDF()} 를 사용한다.
 * pdfbox:3.0.3 는 openhtmltopdf-pdfbox 전이 의존으로 이미 classpath 에 포함되어 있다.
 *
 * <p>추출된 텍스트는 RAG 임베딩 내부용 — 프론트엔드 노출 없음.
 * 손상 PDF / 빈 입력 시 빈 문자열 반환 (예외 전파 금지 — skip &amp; log).
 * PDF 바이너리 내용은 로그에 출력하지 않는다.
 */
@Slf4j
@Component
public class PdfBoxTextExtractor implements PdfTextExtractor {

    @Override
    public String extract(byte[] pdfBytes) {
        if (pdfBytes == null || pdfBytes.length == 0) {
            log.warn("[pdf-extractor] 빈 바이트 배열 — 스킵");
            return "";
        }

        try (PDDocument doc = Loader.loadPDF(pdfBytes)) {
            PDFTextStripper stripper = new PDFTextStripper();
            String text = stripper.getText(doc);
            return text != null ? text.trim() : "";
        } catch (Exception e) {
            // PDF 내용(바이너리)은 로그에 출력하지 않는다 — 사이즈와 오류 메시지만 기록한다
            log.warn("[pdf-extractor] PDF 텍스트 추출 실패 size={}bytes cause={}", pdfBytes.length, e.getMessage());
            return "";
        }
    }
}
