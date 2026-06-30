package io.secureai.backend.domain.compliance.controller;

import io.secureai.backend.domain.compliance.crawler.dto.FeedRefreshResult;
import io.secureai.backend.domain.compliance.dto.ComplianceFeedResponse;
import io.secureai.backend.domain.compliance.service.ComplianceFeedCrawler;
import io.secureai.backend.domain.compliance.service.ComplianceFeedService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.BDDMockito.given;

/**
 * ComplianceFeedController 단위 테스트.
 *
 * <p>JWT 인증(토큰 없으면 401)은 Spring Security 의 anyRequest().authenticated() 와
 * @PreAuthorize("isAuthenticated()") 로 강제되며, 통합 테스트 레벨에서 검증한다.
 * 이 단위 테스트는 컨트롤러 위임 로직과 응답 포맷을 검증한다.
 */
@ExtendWith(MockitoExtension.class)
@DisplayName("ComplianceFeedController 단위 테스트")
class ComplianceFeedControllerTest {

    @Mock ComplianceFeedService complianceFeedService;
    @Mock ComplianceFeedCrawler complianceFeedCrawler;

    private ComplianceFeedController controller;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new ComplianceFeedController(complianceFeedService, complianceFeedCrawler);
    }

    @Test
    @DisplayName("getFeed — 서비스에 위임하고 200 을 반환한다")
    void getFeed_delegatesAndReturns200() {
        ComplianceFeedResponse expected = new ComplianceFeedResponse(
                List.of(), List.of(), List.of()
        );
        given(complianceFeedService.getFeed()).willReturn(expected);

        var response = controller.getFeed(userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData()).isSameAs(expected);
    }

    @Test
    @DisplayName("getFeed — 피드 데이터가 있으면 섹션별 목록을 응답에 포함한다")
    void getFeed_returnsDataWithAllSections() {
        ComplianceFeedResponse.FeedItemDto item = new ComplianceFeedResponse.FeedItemDto(
                UUID.randomUUID(), "KISA", "취약점", "KISA",
                "테스트 피드 제목", "요약 내용", "https://kisa.or.kr/",
                null, List.of(), 1
        );
        ComplianceFeedResponse expected = new ComplianceFeedResponse(
                List.of(item), List.of(), List.of()
        );
        given(complianceFeedService.getFeed()).willReturn(expected);

        var response = controller.getFeed(userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData().govRecommendations()).hasSize(1);
        assertThat(response.getBody().getData().govRecommendations().get(0).title())
                .isEqualTo("테스트 피드 제목");
    }

    @Test
    @DisplayName("getFeed — 테이블이 비어 있으면 모든 섹션이 빈 배열인 200 을 반환한다")
    void getFeed_emptyFeed_returnsEmptyArraysWith200() {
        given(complianceFeedService.getFeed()).willReturn(
                new ComplianceFeedResponse(List.of(), List.of(), List.of())
        );

        var response = controller.getFeed(userId);

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData().govRecommendations()).isEmpty();
        assertThat(response.getBody().getData().securityNews()).isEmpty();
        assertThat(response.getBody().getData().agencyPosts()).isEmpty();
    }

    @Test
    @DisplayName("refreshFeed — 크롤러에 위임하고 200 과 저장/스킵 건수를 반환한다 (Stage B 연결)")
    void refreshFeed_delegatesToCrawlerAndReturns200WithCounts() {
        FeedRefreshResult crawlerResult = new FeedRefreshResult(3, 1, 0);
        given(complianceFeedCrawler.refresh()).willReturn(crawlerResult);

        var response = controller.refreshFeed();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData().saved()).isEqualTo(3);
        assertThat(response.getBody().getData().skipped()).isEqualTo(1);
        assertThat(response.getBody().getData().failed()).isEqualTo(0);
    }

    @Test
    @DisplayName("refreshFeed — 더 이상 501 을 반환하지 않는다 (Stage B 구현 완료)")
    void refreshFeed_notNotImplemented() {
        given(complianceFeedCrawler.refresh()).willReturn(new FeedRefreshResult(0, 0, 0));

        var response = controller.refreshFeed();

        assertThat(response.getStatusCode().value()).isNotEqualTo(501);
    }

    @Test
    @DisplayName("refreshFeed — 크롤러 결과가 모두 0 이면 빈 성공 응답을 반환한다")
    void refreshFeed_zeroResult_returnsSuccess() {
        given(complianceFeedCrawler.refresh()).willReturn(new FeedRefreshResult(0, 0, 0));

        var response = controller.refreshFeed();

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().isSuccess()).isTrue();
    }
}
