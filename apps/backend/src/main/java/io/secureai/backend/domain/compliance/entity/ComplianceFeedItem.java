package io.secureai.backend.domain.compliance.entity;

import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;
import org.hibernate.annotations.JdbcTypeCode;
import org.hibernate.type.SqlTypes;

import java.time.LocalDate;
import java.util.UUID;

/**
 * 컴플라이언스 피드 아이템 엔티티.
 *
 * <p>정부 권장사항·보안 뉴스·기관 보안 게시물을 단일 테이블에 저장한다.
 * {@code section} 컬럼으로 섹션을 구분하고, DB CHECK 제약과 Java enum 양쪽에서 타입 안전성을 보장한다.
 *
 * <p>Stage B: 크롤러가 {@code content}(원문 전체), {@code contentHash}(중복 방지)를 채운다.
 * Stage A에서는 두 필드 모두 NULL.
 */
@Entity
@Table(
    name = "compliance_feed_items",
    indexes = {
        @Index(name = "idx_cfi_section_date", columnList = "section, published_date DESC"),
        @Index(name = "idx_cfi_source_url",   columnList = "source_url")
    }
)
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class ComplianceFeedItem extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /**
     * 피드 섹션 구분. DB CHECK 제약은 V065 마이그레이션에서 관리한다.
     * Java enum 으로 타입 안전성을 보장한다 (매직 스트링 금지).
     */
    @Enumerated(EnumType.STRING)
    @Column(name = "section", length = 30, nullable = false)
    private FeedSection section;

    /** 발행 기관 (KISA, 행정안전부, 개인정보보호위원회 등) */
    @Column(length = 100)
    private String agency;

    /** 게시물 카테고리 또는 태그 (취약점, 권고문, 랜섬웨어, CVE 등) */
    @Column(length = 150)
    private String category;

    /** 출처 미디어명 (뉴스 매체, 기관 웹사이트 등) */
    @Column(length = 100)
    private String source;

    @Column(length = 500, nullable = false)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String summary;

    /**
     * RAG 임베딩용 본문 전체 텍스트(최대 ComplianceFeedCrawler.CONTENT_MAX_LEN 자) 저장.
     * 프론트엔드 미노출 — 표시는 summary + source_url 링크.
     * Stage A 시드 데이터는 NULL.
     */
    @Column(columnDefinition = "TEXT")
    private String content;

    @Column(length = 1000)
    private String sourceUrl;

    /**
     * 게시일. GOV_RECOMMENDATION 은 월 단위 표기이므로 해당 월 1일로 저장한다.
     * SECURITY_NEWS / AGENCY_POST 는 실제 게시일.
     */
    private LocalDate publishedDate;

    /**
     * 첨부파일 메타데이터 JSONB 배열 [{name, type, size}].
     * Stage B 크롤러가 실제 첨부 목록을 채운다. Stage A 에서는 빈 배열.
     * 원문 파일을 서버에 저장하지 않고 source_url 링크로 다운로드를 안내한다.
     */
    @JdbcTypeCode(SqlTypes.JSON)
    @Column(columnDefinition = "jsonb", nullable = false)
    @Builder.Default
    private String files = "[]";

    /**
     * 크롤러 중복 적재 방지용 해시 (SHA-256(source_url + content_preview)).
     * Stage A 에서는 NULL — 크롤러 미구현.
     */
    @Column(length = 64)
    private String contentHash;

    /** 동일 섹션 내 수동 정렬 순서 (낮을수록 상단). 기본 0. */
    @Column(nullable = false)
    @Builder.Default
    private int sortOrder = 0;
}
