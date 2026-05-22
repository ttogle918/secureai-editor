package io.secureai.backend.global.event;

import java.util.UUID;

/**
 * GDPR 하드 삭제 이벤트.
 * GdprHardDeleteService 가 발행하며, 각 도메인 리스너가 연관 데이터를 삭제한다.
 *
 * <p>도메인 간 직접 Repository 주입을 피하기 위해 ApplicationEvent 패턴을 사용한다.
 */
public record GdprUserHardDeleteEvent(UUID userId) {}
