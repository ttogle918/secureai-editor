package io.secureai.backend.domain.user.dto;

import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.user.entity.User;
import lombok.Builder;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@Builder
public class UserMeResponse {

    private UUID id;
    private String email;
    private String username;
    private String displayName;
    private String githubLogin;
    private String timezone;
    private String locale;
    private boolean isAdmin;
    private String avatarUrl;
    private String bio;
    private boolean publicProfile;
    private PlanInfo plan;
    private UsageInfo usage;
    private CreditInfo credits;
    private OffsetDateTime createdAt;

    public static UserMeResponse from(User user) {
        Plan plan = user.getPlan();
        return UserMeResponse.builder()
                .id(user.getId())
                .email(user.getEmail())
                .username(user.getUsername())
                .displayName(user.getDisplayName())
                .githubLogin(user.getGithubLogin())
                .timezone(user.getTimezone())
                .locale(user.getLocale())
                .isAdmin(Boolean.TRUE.equals(user.getIsAdmin()))
                .avatarUrl(user.getAvatarUrl())
                .bio(user.getBio())
                .publicProfile(Boolean.TRUE.equals(user.getPublicProfile()))
                .plan(PlanInfo.from(plan))
                .usage(new UsageInfo(
                        user.getSastUsageThisMonth(),
                        plan.getMonthlySastLimit(),
                        user.getSastUsageResetAt()))
                .credits(new CreditInfo(
                        user.getCreditBalance(),
                        user.getAnthropicApiKey() != null,
                        user.getPreferredModel()))
                .createdAt(user.getCreatedAt())
                .build();
    }

    @Getter
    @Builder
    public static class PlanInfo {
        private short id;
        private String name;
        private String displayName;
        private boolean allowDast;
        private boolean allowMonitoring;

        static PlanInfo from(Plan plan) {
            return PlanInfo.builder()
                    .id(plan.getId())
                    .name(plan.getName())
                    .displayName(plan.getDisplayName())
                    .allowDast(plan.getAllowDast())
                    .allowMonitoring(plan.getAllowMonitoring())
                    .build();
        }
    }

    @Getter
    @Builder
    public static class CreditInfo {
        private int balance;
        private boolean hasByok;
        private String preferredModel;
    }

    @Getter
    @Builder
    public static class UsageInfo {
        private int sastUsageThisMonth;
        private int sastMonthlyLimit;
        private OffsetDateTime sastResetAt;

        UsageInfo(int usage, int limit, OffsetDateTime resetAt) {
            this.sastUsageThisMonth = usage;
            this.sastMonthlyLimit = limit;
            this.sastResetAt = resetAt;
        }
    }
}
