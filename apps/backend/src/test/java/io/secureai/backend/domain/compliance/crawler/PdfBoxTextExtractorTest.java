package io.secureai.backend.domain.compliance.crawler;

import org.apache.pdfbox.pdmodel.PDDocument;
import org.apache.pdfbox.pdmodel.PDPage;
import org.apache.pdfbox.pdmodel.PDPageContentStream;
import org.apache.pdfbox.pdmodel.font.PDType1Font;
import org.apache.pdfbox.pdmodel.font.Standard14Fonts;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.*;

/**
 * PdfBoxTextExtractor 단위 테스트.
 *
 * <p>PDFBox 로 인메모리 PDF 를 생성해 실파일·네트워크 없이 검증한다.
 * 손상된 PDF 는 빈 문자열을 반환하고 예외가 전파되지 않는다 (skip &amp; log).
 */
@DisplayName("PdfBoxTextExtractor 단위 테스트")
class PdfBoxTextExtractorTest {

    private PdfBoxTextExtractor extractor;

    @BeforeEach
    void setUp() {
        extractor = new PdfBoxTextExtractor();
    }

    @Test
    @DisplayName("유효한 PDF — 텍스트가 추출된다")
    void extract_validPdf_returnsText() throws Exception {
        byte[] pdfBytes = createTestPdf("KISA Security Report");

        String result = extractor.extract(pdfBytes);

        assertThat(result).contains("KISA Security Report");
    }

    @Test
    @DisplayName("유효한 PDF — 공백이 trim 된 문자열을 반환한다")
    void extract_validPdf_textIsTrimmed() throws Exception {
        byte[] pdfBytes = createTestPdf("TrimTest");

        String result = extractor.extract(pdfBytes);

        assertThat(result).isEqualTo(result.trim());
    }

    @Test
    @DisplayName("손상된 PDF (임의 바이트) — 예외 없이 빈 문자열을 반환한다 (skip & log)")
    void extract_corruptPdf_returnsEmptyString() {
        byte[] corrupt = "not a pdf at all %%EOF gibberish".getBytes();

        assertThatCode(() -> extractor.extract(corrupt)).doesNotThrowAnyException();
        assertThat(extractor.extract(corrupt)).isEmpty();
    }

    @Test
    @DisplayName("null 바이트 — 예외 없이 빈 문자열을 반환한다 (skip & log)")
    void extract_nullBytes_returnsEmptyString() {
        assertThatCode(() -> extractor.extract(null)).doesNotThrowAnyException();
        assertThat(extractor.extract(null)).isEmpty();
    }

    @Test
    @DisplayName("빈 바이트 배열 — 예외 없이 빈 문자열을 반환한다 (skip & log)")
    void extract_emptyBytes_returnsEmptyString() {
        assertThatCode(() -> extractor.extract(new byte[0])).doesNotThrowAnyException();
        assertThat(extractor.extract(new byte[0])).isEmpty();
    }

    // ── 유틸 ──────────────────────────────────────────────────────────────────

    /**
     * PDFBox 로 단일 페이지 PDF 를 인메모리 생성한다.
     * PDFBox 3.x 에서는 PDType1Font(Standard14Fonts.FontName) 생성자를 사용한다.
     */
    private byte[] createTestPdf(String text) throws Exception {
        try (PDDocument doc = new PDDocument()) {
            PDPage page = new PDPage();
            doc.addPage(page);
            try (PDPageContentStream cs = new PDPageContentStream(doc, page)) {
                cs.beginText();
                cs.setFont(new PDType1Font(Standard14Fonts.FontName.HELVETICA), 12);
                cs.newLineAtOffset(50, 700);
                cs.showText(text);
                cs.endText();
            }
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            doc.save(baos);
            return baos.toByteArray();
        }
    }
}
