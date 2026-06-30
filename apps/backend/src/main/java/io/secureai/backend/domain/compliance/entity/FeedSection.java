package io.secureai.backend.domain.compliance.entity;

/**
 * 컴플라이언스 피드 섹션 구분.
 *
 * <p>DB CHECK 제약은 V065 마이그레이션에서 관리.
 * 매직 스트링 제거를 위해 enum 으로 정의한다.
 *
 * <ul>
 *   <li>GOV_RECOMMENDATION — 정부 권장 사항 (KISA, 행정안전부 등)
 *   <li>SECURITY_NEWS      — 최신 보안 뉴스
 *   <li>AGENCY_POST        — 기관 보안 게시물 (Stage B 크롤러 자동 수집 대상)
 * </ul>
 */
public enum FeedSection {
    GOV_RECOMMENDATION,
    SECURITY_NEWS,
    AGENCY_POST
}
