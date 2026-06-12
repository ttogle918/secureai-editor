package io.secureai.backend.domain.user.entity;

import io.secureai.backend.global.crypto.AesEncryptionConverter;
import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.UUID;

/**
 * 사용자별 멀티-프로바이더 API 키 (BYOK).
 * encrypted_key: AesEncryptionConverter 로 AES-256-GCM 암호화 저장.
 * UNIQUE(user_id, provider) — upsert 패턴으로 재저장.
 */
@Entity
@Table(name = "user_provider_keys")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class UserProviderKey extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    /** FK → users.id. JPA lazy-load 불필요 — userId 필드만 사용. */
    @Column(name = "user_id", nullable = false)
    private UUID userId;

    /** 허용 값: anthropic | gemini | openai (DB CHECK 제약으로도 보장) */
    @Column(nullable = false, length = 20)
    private String provider;

    /** 복호화된 원문 API 키. AES-256-GCM 암호화하여 DB에 저장됨. 로그 출력 금지. */
    @Convert(converter = AesEncryptionConverter.class)
    @Column(name = "encrypted_key", columnDefinition = "TEXT", nullable = false)
    private String apiKey;

    /** 이 provider 사용 시 기본 모델 (null = 플랫폼 기본값 사용) */
    @Column(name = "default_model", length = 60)
    private String defaultModel;
}
