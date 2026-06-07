package io.secureai.backend.domain.credit.service;

import io.secureai.backend.domain.credit.entity.CreditTransaction;
import io.secureai.backend.domain.credit.repository.CreditTransactionRepository;
import io.secureai.backend.domain.plan.Plan;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.model.ModelConstants;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CreditServiceTest {

    @Mock UserRepository userRepository;
    @Mock CreditTransactionRepository txRepository;

    @InjectMocks CreditService creditService;

    @Captor ArgumentCaptor<CreditTransaction> txCaptor;

    private final UUID userId = UUID.randomUUID();
    private final UUID sessionId = UUID.randomUUID();

    // ── deductForScan ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("deductForScan — 정상 차감: SONNET 5크레딧/파일 × 3파일 = 15 차감")
    void deductForScan_deductsCostTimesFiles() {
        User user = mock(User.class);
        when(user.getAnthropicApiKey()).thenReturn(null);
        when(user.getCreditBalance()).thenReturn(100);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        creditService.deductForScan(userId, sessionId, ModelConstants.SONNET, 3);

        verify(user).setCreditBalance(85);          // 100 - (5 * 3)
        verify(userRepository).save(user);
        verify(txRepository).save(txCaptor.capture());
        CreditTransaction tx = txCaptor.getValue();
        assertThat(tx.getDelta()).isEqualTo(-15);
        assertThat(tx.getReason()).isEqualTo("sast_scan");
        assertThat(tx.getFilesCount()).isEqualTo(3);
    }

    @Test
    @DisplayName("deductForScan — 잔액 부족 시 0으로 클램프된다 (음수가 되지 않는다)")
    void deductForScan_clampsBalanceAtZero() {
        User user = mock(User.class);
        when(user.getAnthropicApiKey()).thenReturn(null);
        when(user.getCreditBalance()).thenReturn(10);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        creditService.deductForScan(userId, sessionId, ModelConstants.OPUS, 2); // cost 40

        verify(user).setCreditBalance(0);
        verify(txRepository).save(txCaptor.capture());
        assertThat(txCaptor.getValue().getDelta()).isEqualTo(-40);
    }

    @Test
    @DisplayName("deductForScan — BYOK(사용자 자체 키) 사용 중이면 차감하지 않고 byok_bypass로 기록한다")
    void deductForScan_byokDoesNotDeduct() {
        User user = mock(User.class);
        when(user.getAnthropicApiKey()).thenReturn("sk-user-key");
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        creditService.deductForScan(userId, sessionId, ModelConstants.OPUS, 5);

        verify(user, never()).setCreditBalance(anyInt());
        verify(userRepository, never()).save(any());
        verify(txRepository).save(txCaptor.capture());
        CreditTransaction tx = txCaptor.getValue();
        assertThat(tx.getDelta()).isZero();
        assertThat(tx.getReason()).isEqualTo("byok_bypass");
    }

    @Test
    @DisplayName("deductForScan — 사용자가 없으면 BusinessException")
    void deductForScan_userNotFound_throws() {
        when(userRepository.findById(userId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> creditService.deductForScan(userId, sessionId, ModelConstants.HAIKU, 1))
                .isInstanceOf(BusinessException.class);
        verify(txRepository, never()).save(any());
    }

    // ── grantMonthly ──────────────────────────────────────────────────────────

    @Test
    @DisplayName("grantMonthly — 플랜의 월 크레딧을 잔액에 더한다")
    void grantMonthly_addsPlanCredits() {
        User user = mock(User.class);
        Plan plan = mock(Plan.class);
        when(plan.getMonthlyCredits()).thenReturn(500);
        when(user.getPlan()).thenReturn(plan);
        when(user.getCreditBalance()).thenReturn(100);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        creditService.grantMonthly(userId);

        verify(user).setCreditBalance(600);
        verify(txRepository).save(txCaptor.capture());
        CreditTransaction tx = txCaptor.getValue();
        assertThat(tx.getDelta()).isEqualTo(500);
        assertThat(tx.getReason()).isEqualTo("monthly_grant");
    }

    @Test
    @DisplayName("grantMonthly — 월 크레딧이 0 이하면 아무 것도 하지 않는다")
    void grantMonthly_nonPositive_noop() {
        User user = mock(User.class);
        Plan plan = mock(Plan.class);
        when(plan.getMonthlyCredits()).thenReturn(0);
        when(user.getPlan()).thenReturn(plan);
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));

        creditService.grantMonthly(userId);

        verify(user, never()).setCreditBalance(anyInt());
        verify(userRepository, never()).save(any());
        verify(txRepository, never()).save(any());
    }

    // ── hasEnough ───────────────────────────────────────────────────────────────

    @Test
    @DisplayName("hasEnough — BYOK면 잔액과 무관하게 항상 true")
    void hasEnough_byokAlwaysTrue() {
        User user = mock(User.class);
        when(user.getAnthropicApiKey()).thenReturn("sk-user-key");

        assertThat(creditService.hasEnough(user, 9999)).isTrue();
    }

    @Test
    @DisplayName("hasEnough — 잔액이 요구치 이상이면 true, 미만이면 false")
    void hasEnough_comparesBalance() {
        User user = mock(User.class);
        when(user.getAnthropicApiKey()).thenReturn(null);
        when(user.getCreditBalance()).thenReturn(50);

        assertThat(creditService.hasEnough(user, 50)).isTrue();
        assertThat(creditService.hasEnough(user, 51)).isFalse();
    }

    // ── grantSignupBonus ────────────────────────────────────────────────────────

    @Test
    @DisplayName("grantSignupBonus — 현재 잔액을 signup_bonus 트랜잭션으로 기록한다")
    void grantSignupBonus_recordsBalance() {
        User user = mock(User.class);
        when(user.getCreditBalance()).thenReturn(100);

        creditService.grantSignupBonus(user);

        verify(txRepository).save(txCaptor.capture());
        CreditTransaction tx = txCaptor.getValue();
        assertThat(tx.getDelta()).isEqualTo(100);
        assertThat(tx.getReason()).isEqualTo("signup_bonus");
    }
}
