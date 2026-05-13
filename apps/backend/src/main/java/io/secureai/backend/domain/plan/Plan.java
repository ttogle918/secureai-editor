package io.secureai.backend.domain.plan;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.OffsetDateTime;

@Entity
@Table(name = "plans")
@Getter
@NoArgsConstructor
public class Plan {

    @Id
    private Short id;

    @Column(nullable = false, unique = true, length = 20)
    private String name;

    @Column(nullable = false, length = 50)
    private String displayName;

    @Column(nullable = false)
    private Integer monthlyPriceKrw;

    @Column(nullable = false)
    private Short maxMembers;

    @Column(nullable = false)
    private Integer monthlySastLimit;

    @Column(nullable = false)
    private Boolean allowPrivateRepo;

    @Column(nullable = false)
    private Boolean allowDast;

    @Column(nullable = false)
    private Boolean allowMonitoring;

    @Column(nullable = false)
    private Boolean allowPdfReport;

    @Column(nullable = false)
    private Boolean allowSbom;

    @Column(nullable = false)
    private Boolean allowSso;

    @Column(nullable = false)
    private Short apiRateLimitPerMin;

    /** 월 지급 크레딧. -1 = 무제한 */
    @Column(nullable = false)
    private Integer monthlyCredits;

    @Column(nullable = false, updatable = false)
    private OffsetDateTime createdAt;
}
