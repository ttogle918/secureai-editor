package io.secureai.backend.domain.compliance.crawler.dto;

/**
 * 컴플라이언스 피드 갱신 결과 DTO.
 *
 * <p>수동 트리거(POST /admin/compliance/feed/refresh) 응답 및
 * 스케줄 잡 로그에서 사용한다.
 *
 * @param saved   신규 적재된 아이템 수
 * @param skipped 중복(contentHash 충돌)으로 스킵된 아이템 수
 * @param failed  파싱·네트워크 오류로 실패한 소스 수
 */
public record FeedRefreshResult(int saved, int skipped, int failed) {}
