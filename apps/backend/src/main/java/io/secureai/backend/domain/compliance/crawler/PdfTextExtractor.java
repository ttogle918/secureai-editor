package io.secureai.backend.domain.compliance.crawler;

/**
 * PDF 바이너리에서 텍스트를 추출하는 인터페이스.
 *
 * <p>네트워크 fetch 와 텍스트 추출을 분리한다.
 * 구현체({@link PdfBoxTextExtractor})는 PDFBox 를 사용하고,
 * 테스트에서는 mock 으로 대체해 실파일 없이 검증한다 (DIP).
 *
 * <p>규칙:
 * <ul>
 *   <li>추출 실패(손상 PDF, 빈 입력) 시 빈 문자열 반환 (예외 전파 금지 — skip &amp; log).</li>
 *   <li>PDF 바이너리 내용은 로그에 출력하지 않는다 (민감 정보 보호).</li>
 * </ul>
 */
public interface PdfTextExtractor {

    /**
     * PDF 바이트 배열에서 텍스트를 추출한다.
     *
     * @param pdfBytes PDF 파일 바이트 배열
     * @return 추출된 텍스트. 실패 시 빈 문자열 반환.
     */
    String extract(byte[] pdfBytes);
}
