package io.secureai.backend.domain.usage.entity;

import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.UUID;

/**
 * 세션 종료 시 집계된 토큰 사용량 엔티티 (COST-3).
 *
 * occurred_at 은 세션 완료 시각으로, 월 집계에 사용된다.
 * cost_usd 는 PricingTable로 계산된 추정 비용이다.
 */
@Entity
@Table(name = "token_usage")
@Getter
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor
@Builder
public class TokenUsage {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @Column(name = "session_id", nullable = false)
    private UUID sessionId;

    @Column(name = "user_id", nullable = false)
    private UUID userId;

    @Column(name = "project_id", nullable = false)
    private UUID projectId;

    /** LLM 프로바이더 식별자 (anthropic | gemini | openai) */
    @Column(name = "provider", nullable = false, length = 20)
    private String provider;

    /** 사용된 모델명 */
    @Column(name = "model", nullable = false, length = 60)
    private String model;

    @Column(name = "input_tokens", nullable = false)
    @Builder.Default
    private long inputTokens = 0L;

    @Column(name = "output_tokens", nullable = false)
    @Builder.Default
    private long outputTokens = 0L;

    /** 프롬프트 캐시 생성 토큰 (Anthropic prompt caching 전용) */
    @Column(name = "cache_creation_tokens", nullable = false)
    @Builder.Default
    private long cacheCreationTokens = 0L;

    /** 프롬프트 캐시 읽기 토큰 (Anthropic prompt caching 전용) */
    @Column(name = "cache_read_tokens", nullable = false)
    @Builder.Default
    private long cacheReadTokens = 0L;

    /** PricingTable로 계산된 추정 비용 (USD) */
    @Column(name = "cost_usd", nullable = false, precision = 12, scale = 6)
    @Builder.Default
    private BigDecimal costUsd = BigDecimal.ZERO;

    @Column(name = "occurred_at", nullable = false)
    @Builder.Default
    private OffsetDateTime occurredAt = OffsetDateTime.now();
}
