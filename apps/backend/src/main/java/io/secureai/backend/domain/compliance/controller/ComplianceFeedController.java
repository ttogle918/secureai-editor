package io.secureai.backend.domain.compliance.controller;

import io.secureai.backend.domain.compliance.dto.ComplianceFeedResponse;
import io.secureai.backend.domain.compliance.service.ComplianceFeedService;
import io.secureai.backend.global.response.ApiResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.UUID;

/**
 * 컴플라이언스 외부 피드 API.
 *
 * <p>기존 {@link ComplianceController}(프로젝트 세션별 OWASP 매핑)와 완전 독립적인 컨트롤러.
 *
 * <ul>
 *   <li>GET  /api/v1/compliance/feed — 정부 권장사항·보안 뉴스·기관 게시물 피드 조회
 *   <li>POST /api/v1/admin/compliance/feed/refresh — [Stage B 크롤러 연결 지점] 현재 501 스텁
 * </ul>
 *
 * <p>입력 파라미터가 없으므로 Controller 레이어 추가 검증이 불필요하다.
 * JWT 인증은 SecurityConfig.anyRequest().authenticated()로 강제되며,
 * {@code @PreAuthorize}는 메서드 레벨 명시적 보호를 위해 추가한다.
 */
@RestController
@RequiredArgsConstructor
public class ComplianceFeedController {

    private final ComplianceFeedService complianceFeedService;

    /**
     * 컴플라이언스 피드 조회.
     *
     * <p>JWT 인증 필수. 토큰이 없거나 유효하지 않으면 Spring Security 가 401 을 반환한다.
     *
     * @param userId 인증된 사용자 ID (향후 개인화·감사 로그 활용 예정)
     * @return 섹션별 그룹화된 피드 응답
     */
    @GetMapping("/api/v1/compliance/feed")
    @PreAuthorize("isAuthenticated()")
    public ResponseEntity<ApiResponse<ComplianceFeedResponse>> getFeed(
            @AuthenticationPrincipal UUID userId) {
        ComplianceFeedResponse feed = complianceFeedService.getFeed();
        return ResponseEntity.ok(ApiResponse.success(feed));
    }

    /**
     * [Stage B 크롤러 연결 지점] 컴플라이언스 피드 수동 갱신.
     *
     * <p>현재 501 Not Implemented 를 반환한다.
     * Stage B 에서 KISA 등 기관 사이트 크롤러를 연동하고
     * compliance_feed_items 테이블에 적재하는 실제 로직으로 교체한다.
     *
     * <p>TODO: Stage B — 실제 KISA 크롤러(보안공지 게시판) 연동 후 구현 예정.
     */
    @PostMapping("/api/v1/admin/compliance/feed/refresh")
    @PreAuthorize("@adminGuard.check(authentication)")
    public ResponseEntity<Void> refreshFeed() {
        // Stage B 크롤러 연결 지점 — 라이브 스크래핑 미구현
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}
