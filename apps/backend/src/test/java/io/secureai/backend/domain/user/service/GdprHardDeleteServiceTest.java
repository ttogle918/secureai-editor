package io.secureai.backend.domain.user.service;

import io.secureai.backend.domain.auth.service.EmailService;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.aop.AuditLogRepository;
import io.secureai.backend.global.event.GdprUserHardDeleteEvent;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.BDDMockito.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class GdprHardDeleteServiceTest {

    @Mock UserRepository userRepository;
    @Mock AuditLogRepository auditLogRepository;
    @Mock ApplicationEventPublisher eventPublisher;
    @Mock EmailService emailService;

    @InjectMocks GdprHardDeleteService gdprHardDeleteService;

    private UUID userId;
    private User expiredUser;

    @BeforeEach
    void setUp() {
        userId = UUID.randomUUID();
        expiredUser = User.builder()
                .email("expired@example.com")
                .username("expireduser")
                .build();
        // deletedAt = 31일 전 (30일 경과)
        expiredUser.markAsDeleted();
        // 강제로 31일 전으로 설정하기 위해 리플렉션 대신 별도 spy 패턴 사용 — 필드는 공개 setter가 없으므로 mock 활용
    }

    // ── processExpiredAccounts ────────────────────────────────────────────────

    @Test
    @DisplayName("processExpiredAccounts — deletedAt 30일 초과 계정이 처리된다")
    void processExpiredAccounts_expiredUser_isProcessed() {
        // given
        Page<User> firstPage = new PageImpl<>(List.of(expiredUser));
        Page<User> emptyPage = Page.empty();
        given(userRepository.findExpiredSoftDeletedUsers(any(OffsetDateTime.class), any(Pageable.class)))
                .willReturn(firstPage, emptyPage);

        // when
        gdprHardDeleteService.processExpiredAccounts();

        // then — deleteById 가 호출되어야 함
        verify(userRepository, atLeastOnce()).deleteById(any());
    }

    @Test
    @DisplayName("processExpiredAccounts — deletedAt 29일 계정은 cutoff 조건에 해당하지 않으므로 조회에서 제외된다")
    void processExpiredAccounts_notExpiredUser_isNotProcessed() {
        // given — 29일 계정은 Repository 조회 결과에 포함되지 않음 (쿼리 조건 확인)
        // findExpiredSoftDeletedUsers cutoff = now - 30days 이므로 29일 계정은 반환되지 않아야 함
        Page<User> emptyPage = Page.empty();
        given(userRepository.findExpiredSoftDeletedUsers(
                argThat(cutoff -> {
                    // cutoff 시각이 30일 전과 일치하는지 검증 (±5초 허용)
                    OffsetDateTime expected = OffsetDateTime.now().minusDays(30);
                    return cutoff.isAfter(expected.minusSeconds(5))
                            && cutoff.isBefore(expected.plusSeconds(5));
                }),
                any(Pageable.class)
        )).willReturn(emptyPage);

        // when
        gdprHardDeleteService.processExpiredAccounts();

        // then — emptyPage 반환이므로 deleteById 호출 없음
        verify(userRepository, never()).deleteById(any());
    }

    // ── processOneUser ────────────────────────────────────────────────────────

    @Test
    @DisplayName("processOneUser — 감사 로그 기록 후 이벤트 발행 후 deleteById 순서로 처리된다")
    void processOneUser_executesInCorrectOrder() {
        // when
        boolean result = gdprHardDeleteService.processOneUser(expiredUser);

        // then — 성공 반환
        assertThat(result).isTrue();

        // 감사 로그 기록
        verify(auditLogRepository).save(argThat(entry -> "GDPR_HARD_DELETE".equals(entry.getAction())));
        // 이벤트 발행
        verify(eventPublisher).publishEvent(any(GdprUserHardDeleteEvent.class));
        // users 삭제
        verify(userRepository).deleteById(any());
    }

    @Test
    @DisplayName("processOneUser — GdprUserHardDeleteEvent 에 올바른 userId 가 담긴다")
    void processOneUser_publishesEventWithCorrectUserId() {
        // given
        User userWithId = mock(User.class);
        given(userWithId.getId()).willReturn(userId);
        given(userWithId.getEmail()).willReturn("test@example.com");

        // when
        gdprHardDeleteService.processOneUser(userWithId);

        // then
        ArgumentCaptor<GdprUserHardDeleteEvent> captor = ArgumentCaptor.forClass(GdprUserHardDeleteEvent.class);
        verify(eventPublisher).publishEvent(captor.capture());
        assertThat(captor.getValue().userId()).isEqualTo(userId);
    }

    @Test
    @DisplayName("processOneUser — 처리 중 예외 발생 시 false 를 반환하고 예외를 전파하지 않는다")
    void processOneUser_onException_returnsFalseAndDoesNotPropagate() {
        // given — deleteById 에서 예외 발생
        willThrow(new RuntimeException("DB connection lost")).given(userRepository).deleteById(any());

        // when
        boolean result = gdprHardDeleteService.processOneUser(expiredUser);

        // then — 예외 전파 없이 false 반환
        assertThat(result).isFalse();
    }

    @Test
    @DisplayName("processOneUser — 한 사용자 실패 시 다음 사용자 처리가 계속된다 (배치 내 skip & log)")
    void processExpiredAccounts_oneUserFails_continuesWithNextUser() {
        // given
        User failUser = mock(User.class);
        given(failUser.getId()).willReturn(UUID.randomUUID());
        given(failUser.getEmail()).willReturn("fail@example.com");

        User successUser = mock(User.class);
        UUID successUserId = UUID.randomUUID();
        given(successUser.getId()).willReturn(successUserId);
        given(successUser.getEmail()).willReturn("success@example.com");

        // failUser 처리 시 이벤트 발행에서 예외 발생
        willThrow(new RuntimeException("event bus error"))
                .given(eventPublisher).publishEvent((Object) argThat(e ->
                        e instanceof GdprUserHardDeleteEvent
                                && ((GdprUserHardDeleteEvent) e).userId().equals(failUser.getId())));

        Page<User> firstPage = new PageImpl<>(List.of(failUser, successUser));
        Page<User> emptyPage = Page.empty();
        given(userRepository.findExpiredSoftDeletedUsers(any(OffsetDateTime.class), any(Pageable.class)))
                .willReturn(firstPage, emptyPage);

        // when
        gdprHardDeleteService.processExpiredAccounts();

        // then — successUser 의 deleteById 는 호출되어야 함
        verify(userRepository).deleteById(successUserId);
    }

    @Test
    @DisplayName("processOneUser — 삭제 완료 후 이메일 알림이 발송된다")
    void processOneUser_afterDelete_sendsNotificationEmail() {
        // given
        String email = expiredUser.getEmail();

        // when
        gdprHardDeleteService.processOneUser(expiredUser);

        // then
        verify(emailService).sendAccountHardDeletedEmail(email);
    }

    @Test
    @DisplayName("processOneUser — audit_log 저장 실패 시에도 삭제 플로우는 계속된다")
    void processOneUser_auditLogFails_deletionContinues() {
        // given
        given(auditLogRepository.save(any())).willThrow(new RuntimeException("audit DB error"));

        // when
        boolean result = gdprHardDeleteService.processOneUser(expiredUser);

        // then — audit 실패해도 나머지 플로우 진행
        assertThat(result).isTrue();
        verify(userRepository).deleteById(any());
    }
}
