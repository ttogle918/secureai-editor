package io.secureai.backend.domain.compliance.crawler.dto;

import java.util.List;

/**
 * 게시물 상세 페이지 파싱 결과.
 *
 * <p>RAG 임베딩 원천용 내부 DTO — 프론트엔드 노출 없음.
 * 화면 표시는 기존 summary + source_url 링크를 사용하며,
 * content 는 Stage C 임베딩 파이프라인에서만 소비된다.
 *
 * @param bodyText        상세 페이지 본문 텍스트 (스크립트·스타일·네비 제거 후). 없으면 빈 문자열.
 * @param pdfDownloadUrls 첨부 PDF 다운로드 절대 URL 목록. 없으면 빈 목록.
 */
public record DetailFetchResult(String bodyText, List<String> pdfDownloadUrls) {

    /** 파싱 실패·본문 없음 등 best-effort 실패 시 반환할 빈 결과. */
    public static DetailFetchResult empty() {
        return new DetailFetchResult("", List.of());
    }
}
