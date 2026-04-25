package io.secureai.backend.config;

import io.secureai.backend.domain.plan.PlanRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Component
@RequiredArgsConstructor
public class DataInitializer implements ApplicationRunner {

    private final PlanRepository planRepository;
    private final JdbcTemplate jdbcTemplate;

    @Override
    @Transactional
    public void run(ApplicationArguments args) {
        if (planRepository.count() == 0) {
            log.info("Seeding plans table...");
            jdbcTemplate.execute("""
                INSERT INTO plans (id, name, display_name, monthly_price_krw, max_members, monthly_sast_limit,
                                   allow_private_repo, allow_dast, allow_monitoring, allow_pdf_report, allow_sbom,
                                   allow_sso, api_rate_limit_per_min, created_at)
                VALUES
                    (1, 'free',       '무료',       0,      1,  50,  false, false, false, false, false, false, 10,  NOW()),
                    (2, 'pro',        'Pro',        19900,  1,  -1,  true,  true,  false, true,  true,  false, 60,  NOW()),
                    (3, 'team',       'Team',       59000,  5,  -1,  true,  true,  true,  true,  true,  false, 120, NOW()),
                    (4, 'enterprise', 'Enterprise', 0,      -1, -1,  true,  true,  true,  true,  true,  true,  -1,  NOW())
                ON CONFLICT (id) DO NOTHING
                """);
            log.info("Plans seeded: {} rows", planRepository.count());
        }
    }
}
