package io.secureai.backend.domain.compliance.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import io.secureai.backend.domain.compliance.dto.ComplianceFeedResponse;
import io.secureai.backend.domain.compliance.entity.ComplianceFeedItem;
import io.secureai.backend.domain.compliance.entity.FeedSection;
import io.secureai.backend.domain.compliance.repository.ComplianceFeedItemRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.given;

@ExtendWith(MockitoExtension.class)
@DisplayName("ComplianceFeedService 단위 테스트")
class ComplianceFeedServiceTest {

    @Mock ComplianceFeedItemRepository repository;

    // Spring Boot 자동 구성 없이 실제 ObjectMapper 사용 — Jackson 2.12+ 레코드 지원
    private ComplianceFeedService service;

    private ComplianceFeedItem govRec;
    private ComplianceFeedItem newsItem;
    private ComplianceFeedItem agencyPost;

    @BeforeEach
    void setUp() {
        service = new ComplianceFeedService(repository, new ObjectMapper());

        govRec = ComplianceFeedItem.builder()
                .id(UUID.randomUUID())
                .section(FeedSection.GOV_RECOMMENDATION)
                .agency("KISA")
                .category("생성형 AI 보안")
                .title("생성형 AI 서비스 보안 가이드")
                .summary("LLM 연동 서비스 보안 권고.")
                .sourceUrl("https://www.kisa.or.kr/")
                .publishedDate(LocalDate.of(2026, 6, 1))
                .files("[]")
                .sortOrder(1)
                .build();

        newsItem = ComplianceFeedItem.builder()
                .id(UUID.randomUUID())
                .section(FeedSection.SECURITY_NEWS)
                .agency("보안뉴스")
                .category("취약점")
                .title("오픈소스 라이브러리 RCE 취약점 발견")
                .sourceUrl("https://www.boannews.com/")
                .publishedDate(LocalDate.of(2026, 6, 27))
                .files("[]")
                .sortOrder(1)
                .build();

        agencyPost = ComplianceFeedItem.builder()
                .id(UUID.randomUUID())
                .section(FeedSection.AGENCY_POST)
                .agency("KISA")
                .category("가이드라인 / 보안취약점·침해사고 대응")
                .title("SW 공급망 보안 강화 로드맵 발표(2026.06.)")
                .summary("3대 전략으로 구성된 공급망 보안 로드맵.")
                .sourceUrl("https://www.kisa.or.kr/2060204/form?postSeq=24&page=1")
                .publishedDate(LocalDate.of(2026, 6, 24))
                .files("[{\"name\":\"report.pdf\",\"type\":\"PDF\",\"size\":\"2MB\"}]")
                .sortOrder(1)
                .build();
    }

    @Test
    @DisplayName("getFeed — 테이블이 비어 있으면 모든 섹션이 빈 배열이다")
    void getFeed_emptyTable_returnsEmptyArrays() {
        given(repository.findBySection(FeedSection.GOV_RECOMMENDATION)).willReturn(List.of());
        given(repository.findBySection(FeedSection.SECURITY_NEWS)).willReturn(List.of());
        given(repository.findBySection(FeedSection.AGENCY_POST)).willReturn(List.of());

        ComplianceFeedResponse result = service.getFeed();

        assertThat(result.govRecommendations()).isEmpty();
        assertThat(result.securityNews()).isEmpty();
        assertThat(result.agencyPosts()).isEmpty();
    }

    @Test
    @DisplayName("getFeed — 정부 권장사항 아이템이 govRecommendations 에 그룹화된다")
    void getFeed_govRecommendationsGrouped() {
        given(repository.findBySection(FeedSection.GOV_RECOMMENDATION)).willReturn(List.of(govRec));
        given(repository.findBySection(FeedSection.SECURITY_NEWS)).willReturn(List.of());
        given(repository.findBySection(FeedSection.AGENCY_POST)).willReturn(List.of());

        ComplianceFeedResponse result = service.getFeed();

        assertThat(result.govRecommendations()).hasSize(1);
        assertThat(result.govRecommendations().get(0).title()).isEqualTo("생성형 AI 서비스 보안 가이드");
        assertThat(result.govRecommendations().get(0).agency()).isEqualTo("KISA");
        assertThat(result.securityNews()).isEmpty();
        assertThat(result.agencyPosts()).isEmpty();
    }

    @Test
    @DisplayName("getFeed — 3개 섹션이 각각 올바르게 분리된다")
    void getFeed_allSectionsGroupedCorrectly() {
        given(repository.findBySection(FeedSection.GOV_RECOMMENDATION)).willReturn(List.of(govRec));
        given(repository.findBySection(FeedSection.SECURITY_NEWS)).willReturn(List.of(newsItem));
        given(repository.findBySection(FeedSection.AGENCY_POST)).willReturn(List.of(agencyPost));

        ComplianceFeedResponse result = service.getFeed();

        assertThat(result.govRecommendations()).hasSize(1);
        assertThat(result.securityNews()).hasSize(1);
        assertThat(result.agencyPosts()).hasSize(1);

        assertThat(result.govRecommendations().get(0).agency()).isEqualTo("KISA");
        assertThat(result.securityNews().get(0).title()).isEqualTo("오픈소스 라이브러리 RCE 취약점 발견");
        assertThat(result.agencyPosts().get(0).title()).isEqualTo("SW 공급망 보안 강화 로드맵 발표(2026.06.)");
    }

    @Test
    @DisplayName("getFeed — JSONB files 필드가 FileAttachmentDto 목록으로 역직렬화된다")
    void getFeed_filesJsonDeserializedToList() {
        given(repository.findBySection(FeedSection.GOV_RECOMMENDATION)).willReturn(List.of());
        given(repository.findBySection(FeedSection.SECURITY_NEWS)).willReturn(List.of());
        given(repository.findBySection(FeedSection.AGENCY_POST)).willReturn(List.of(agencyPost));

        ComplianceFeedResponse result = service.getFeed();

        ComplianceFeedResponse.FeedItemDto item = result.agencyPosts().get(0);
        assertThat(item.files()).hasSize(1);
        assertThat(item.files().get(0).name()).isEqualTo("report.pdf");
        assertThat(item.files().get(0).type()).isEqualTo("PDF");
        assertThat(item.files().get(0).size()).isEqualTo("2MB");
    }

    @Test
    @DisplayName("getFeed — files 빈 배열이면 FileAttachmentDto 목록도 빈 배열이다")
    void getFeed_emptyFilesJson_returnsEmptyList() {
        given(repository.findBySection(FeedSection.GOV_RECOMMENDATION)).willReturn(List.of(govRec));
        given(repository.findBySection(FeedSection.SECURITY_NEWS)).willReturn(List.of());
        given(repository.findBySection(FeedSection.AGENCY_POST)).willReturn(List.of());

        ComplianceFeedResponse result = service.getFeed();

        assertThat(result.govRecommendations().get(0).files()).isEmpty();
    }

    @Test
    @DisplayName("getFeed — files JSONB 파싱 실패 시 빈 목록 반환으로 전체 피드를 중단하지 않는다 (skip & log)")
    void getFeed_invalidFilesJson_returnsEmptyFilesGracefully() {
        ComplianceFeedItem brokenItem = ComplianceFeedItem.builder()
                .id(UUID.randomUUID())
                .section(FeedSection.AGENCY_POST)
                .title("파싱 실패 아이템")
                .files("{invalid-json}")
                .sortOrder(0)
                .build();

        given(repository.findBySection(FeedSection.GOV_RECOMMENDATION)).willReturn(List.of());
        given(repository.findBySection(FeedSection.SECURITY_NEWS)).willReturn(List.of());
        given(repository.findBySection(FeedSection.AGENCY_POST)).willReturn(List.of(brokenItem));

        // 전체 피드 반환이 예외 없이 완료되어야 한다
        assertThatCode(() -> service.getFeed()).doesNotThrowAnyException();

        ComplianceFeedResponse result = service.getFeed();
        assertThat(result.agencyPosts()).hasSize(1);
        assertThat(result.agencyPosts().get(0).files()).isEmpty();
    }

    @Test
    @DisplayName("getFeed — publishedDate 가 FeedItemDto 에 포함된다")
    void getFeed_publishedDateIncluded() {
        given(repository.findBySection(FeedSection.GOV_RECOMMENDATION)).willReturn(List.of(govRec));
        given(repository.findBySection(FeedSection.SECURITY_NEWS)).willReturn(List.of());
        given(repository.findBySection(FeedSection.AGENCY_POST)).willReturn(List.of());

        ComplianceFeedResponse result = service.getFeed();

        assertThat(result.govRecommendations().get(0).publishedDate())
                .isEqualTo(LocalDate.of(2026, 6, 1));
    }

    @Test
    @DisplayName("getFeed — sourceUrl 이 FeedItemDto 에 포함된다")
    void getFeed_sourceUrlIncluded() {
        given(repository.findBySection(FeedSection.GOV_RECOMMENDATION)).willReturn(List.of(govRec));
        given(repository.findBySection(FeedSection.SECURITY_NEWS)).willReturn(List.of());
        given(repository.findBySection(FeedSection.AGENCY_POST)).willReturn(List.of());

        ComplianceFeedResponse result = service.getFeed();

        assertThat(result.govRecommendations().get(0).sourceUrl())
                .isEqualTo("https://www.kisa.or.kr/");
    }
}
