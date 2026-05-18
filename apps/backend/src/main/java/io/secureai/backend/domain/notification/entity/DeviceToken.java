package io.secureai.backend.domain.notification.entity;

import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.global.entity.BaseTimeEntity;
import jakarta.persistence.*;
import lombok.*;
import lombok.experimental.SuperBuilder;

import java.util.UUID;

@Entity
@Table(name = "device_tokens")
@Getter
@Setter
@SuperBuilder
@NoArgsConstructor
@AllArgsConstructor
public class DeviceToken extends BaseTimeEntity {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    // FCM 토큰은 로그에 출력 금지 — toString/Lombok @Data 제외
    @Column(nullable = false, columnDefinition = "TEXT")
    private String token;

    @Column(nullable = false, length = 20)
    @Builder.Default
    private String deviceType = "android";
}
