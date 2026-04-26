package io.secureai.backend.domain.analysis.entity;

import jakarta.persistence.*;
import lombok.*;

import java.time.OffsetDateTime;
import java.util.UUID;

@Entity
@Table(
    name = "analysis_progress_log",
    uniqueConstraints = @UniqueConstraint(
        name = "uk_progress_session_step_target",
        columnNames = {"session_id", "step_name", "target"}
    ),
    indexes = @Index(name = "idx_progress_session_order", columnList = "session_id, step_order")
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnalysisProgressLog {

    @Id
    @GeneratedValue(strategy = GenerationType.UUID)
    private UUID id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "session_id", nullable = false)
    private AnalysisSession session;

    /** scan_files / sast / aggregate */
    @Column(nullable = false, length = 50)
    private String stepName;

    /** 실행 순서 (1=scan, 2=sast, 3=aggregate) */
    @Column(nullable = false)
    private Integer stepOrder;

    /** 파일 경로 또는 세션 단위 스텝은 빈 문자열 */
    @Column(nullable = false, length = 500)
    @Builder.Default
    private String target = "";

    /** started / completed / failed */
    @Column(nullable = false, length = 20)
    private String status;

    @Column(nullable = false)
    private OffsetDateTime startedAt;

    private OffsetDateTime completedAt;

    /** completedAt - startedAt 밀리초 (완료 시 서비스에서 계산) */
    private Integer durationMs;

    /** 상세 정보 JSON 문자열 (취약점 수, 오류 메시지 등) */
    @Column(columnDefinition = "TEXT")
    private String detail;
}
