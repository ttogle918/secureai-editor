package io.secureai.backend.domain.credit.service;

import io.secureai.backend.domain.credit.entity.CreditTransaction;
import io.secureai.backend.domain.credit.repository.CreditTransactionRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import io.secureai.backend.global.model.ModelConstants;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class CreditService {

    private final UserRepository userRepository;
    private final CreditTransactionRepository txRepository;

    /** 분석 완료 시 크레딧 차감. BYOK 사용 중이면 차감하지 않는다. */
    @Transactional
    public void deductForScan(UUID userId, UUID sessionId, String model, int filesCount) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        if (user.getAnthropicApiKey() != null) {
            log.debug("[credit] BYOK scan — no deduction userId={}", userId);
            record(user, 0, "byok_bypass", sessionId, model, filesCount);
            return;
        }

        int cost = ModelConstants.creditCostPerFile(model) * filesCount;
        int newBalance = user.getCreditBalance() - cost;
        if (newBalance < 0) newBalance = 0;

        user.setCreditBalance(newBalance);
        userRepository.save(user);
        record(user, -cost, "sast_scan", sessionId, model, filesCount);
        log.info("[credit] deducted userId={} cost={} model={} files={} balance={}",
                userId, cost, model, filesCount, newBalance);
    }

    /** 월 크레딧 지급 (스케줄러에서 호출) */
    @Transactional
    public void grantMonthly(UUID userId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));
        int grant = user.getPlan().getMonthlyCredits();
        if (grant <= 0) return;
        user.setCreditBalance(user.getCreditBalance() + grant);
        userRepository.save(user);
        record(user, grant, "monthly_grant", null, null, null);
        log.info("[credit] monthly grant userId={} grant={}", userId, grant);
    }

    /** 가입 보너스 (AuthService에서 호출) */
    @Transactional
    public void grantSignupBonus(User user) {
        record(user, user.getCreditBalance(), "signup_bonus", null, null, null);
    }

    public boolean hasEnough(User user, int required) {
        return user.getAnthropicApiKey() != null || user.getCreditBalance() >= required;
    }

    private void record(User user, int delta, String reason, UUID sessionId, String model, Integer filesCount) {
        txRepository.save(CreditTransaction.builder()
                .user(user)
                .delta(delta)
                .reason(reason)
                .sessionId(sessionId)
                .model(model)
                .filesCount(filesCount)
                .balanceAfter(user.getCreditBalance())
                .build());
    }
}
