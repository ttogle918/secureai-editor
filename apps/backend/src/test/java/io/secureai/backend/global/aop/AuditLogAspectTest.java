package io.secureai.backend.global.aop;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.aop.aspectj.annotation.AspectJProxyFactory;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * AuditLogAspect 단위 테스트.
 * AspectJProxyFactory로 AOP 프록시를 직접 생성하여 스프링 컨텍스트 없이 검증한다.
 */
@ExtendWith(MockitoExtension.class)
class AuditLogAspectTest {

    @Mock
    private AuditLogRepository auditLogRepository;

    private AuditLogAspect aspect;
    private StubService proxyService;

    @BeforeEach
    void setUp() {
        aspect = new AuditLogAspect(auditLogRepository);

        StubService target = new StubService();
        AspectJProxyFactory factory = new AspectJProxyFactory(target);
        factory.addAspect(aspect);
        proxyService = factory.getProxy();

        SecurityContextHolder.clearContext();
    }

    // ── @AuditLog 어노테이션 메서드 호출 시 저장 검증 ────────────────────────

    @Test
    @DisplayName("@AuditLog 어노테이션 메서드 호출 시 auditLogRepository.save() 호출")
    void logAudit_whenAnnotatedMethodCalled_savesCalled() {
        // given
        when(auditLogRepository.save(any(AuditLogEntry.class)))
                .thenReturn(mock(AuditLogEntry.class));

        // when
        proxyService.doAuditedAction();

        // then
        verify(auditLogRepository).save(any(AuditLogEntry.class));
    }

    @Test
    @DisplayName("어노테이션의 action, resource 값이 저장 엔트리에 반영")
    void logAudit_actionAndResource_savedCorrectly() {
        // given
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        when(auditLogRepository.save(captor.capture()))
                .thenReturn(mock(AuditLogEntry.class));

        // when
        proxyService.doAuditedAction();

        // then
        AuditLogEntry saved = captor.getValue();
        assertThat(saved.getAction()).isEqualTo("TEST_ACTION");
        assertThat(saved.getResource()).isEqualTo("test-resource");
    }

    @Test
    @DisplayName("SecurityContext에 UUID principal이 있으면 actorId가 저장 엔트리에 반영")
    void logAudit_withAuthenticatedUser_savesActorId() {
        // given
        UUID userId = UUID.randomUUID();
        UsernamePasswordAuthenticationToken auth =
                new UsernamePasswordAuthenticationToken(userId, null, null);
        SecurityContextHolder.getContext().setAuthentication(auth);

        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        when(auditLogRepository.save(captor.capture()))
                .thenReturn(mock(AuditLogEntry.class));

        // when
        proxyService.doAuditedAction();

        // then
        AuditLogEntry saved = captor.getValue();
        assertThat(saved.getActorId()).isEqualTo(userId);
    }

    @Test
    @DisplayName("SecurityContext가 비어있으면 actorId는 null로 저장")
    void logAudit_withNoAuthentication_savesNullActorId() {
        // given (SecurityContext cleared in setUp)
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        when(auditLogRepository.save(captor.capture()))
                .thenReturn(mock(AuditLogEntry.class));

        // when
        proxyService.doAuditedAction();

        // then
        AuditLogEntry saved = captor.getValue();
        assertThat(saved.getActorId()).isNull();
    }

    // ── outcome 구분 검증 ────────────────────────────────────────────────────

    @Test
    @DisplayName("정상 반환 시 outcome=SUCCESS 로 저장")
    void logAudit_onSuccess_savesOutcomeSuccess() {
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        when(auditLogRepository.save(captor.capture())).thenReturn(mock(AuditLogEntry.class));

        proxyService.doAuditedAction();

        assertThat(captor.getValue().getOutcome()).isEqualTo("SUCCESS");
    }

    @Test
    @DisplayName("예외 발생 시 outcome=FAILURE 로 저장되고 예외는 그대로 전파")
    void logAudit_onException_savesOutcomeFailureAndRethrows() {
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        when(auditLogRepository.save(captor.capture())).thenReturn(mock(AuditLogEntry.class));

        assertThatThrownBy(() -> proxyService.doAuditedActionThatThrows())
                .isInstanceOf(RuntimeException.class);

        assertThat(captor.getValue().getOutcome()).isEqualTo("FAILURE");
    }

    @Test
    @DisplayName("예외 발생 시 audit 저장이 실패해도 원래 예외가 전파됨")
    void logAudit_onException_auditSaveFailureDoesNotMaskOriginalException() {
        doThrow(new RuntimeException("DB down")).when(auditLogRepository).save(any());

        assertThatThrownBy(() -> proxyService.doAuditedActionThatThrows())
                .isInstanceOf(IllegalStateException.class)
                .hasMessage("business error");
    }

    // ── 저장 실패 시 예외 전파 금지 ───────────────────────────────────────────

    @Test
    @DisplayName("auditLogRepository.save() 예외 발생 시 원래 메서드 반환값에 영향 없음")
    void logAudit_whenSaveFails_doesNotPropagateException() {
        // given
        doThrow(new RuntimeException("DB connection lost"))
                .when(auditLogRepository).save(any(AuditLogEntry.class));

        // when / then — 예외가 전파되지 않아야 한다
        assertThatCode(() -> proxyService.doAuditedAction())
                .doesNotThrowAnyException();
    }

    @Test
    @DisplayName("저장 실패해도 원래 메서드의 반환값은 정상적으로 반환")
    void logAudit_whenSaveFails_returnValueIsPreserved() {
        // given
        doThrow(new RuntimeException("DB connection lost"))
                .when(auditLogRepository).save(any(AuditLogEntry.class));

        // when
        String result = proxyService.doAuditedActionWithReturn();

        // then
        assertThat(result).isEqualTo("ok");
    }

    @Test
    @DisplayName("@AuditLog 없는 메서드는 save() 호출하지 않음")
    void logAudit_whenMethodNotAnnotated_saveNotCalled() {
        // when
        proxyService.doUnannotatedAction();

        // then
        verify(auditLogRepository, never()).save(any());
    }

    // ── action 값이 비어있으면 메서드명으로 폴백 ────────────────────────────────

    @Test
    @DisplayName("action이 빈 문자열이면 메서드명을 action으로 저장")
    void logAudit_whenActionEmpty_usesMethodName() {
        // given
        ArgumentCaptor<AuditLogEntry> captor = ArgumentCaptor.forClass(AuditLogEntry.class);
        when(auditLogRepository.save(captor.capture()))
                .thenReturn(mock(AuditLogEntry.class));

        // when
        proxyService.doActionWithNoExplicitAction();

        // then
        AuditLogEntry saved = captor.getValue();
        assertThat(saved.getAction()).isEqualTo("doActionWithNoExplicitAction");
        assertThat(saved.getResource()).isNull();
    }

    // ── 테스트용 스텁 서비스 ────────────────────────────────────────────────────

    static class StubService {

        @AuditLog(action = "TEST_ACTION", resource = "test-resource")
        public void doAuditedAction() {
            // stub
        }

        @AuditLog(action = "TEST_ACTION", resource = "test-resource")
        public String doAuditedActionWithReturn() {
            return "ok";
        }

        public void doUnannotatedAction() {
            // @AuditLog 없음
        }

        @AuditLog
        public void doActionWithNoExplicitAction() {
            // action = "" (기본값), resource = "" (기본값)
        }

        @AuditLog(action = "TEST_FAIL", resource = "test-resource")
        public void doAuditedActionThatThrows() {
            throw new IllegalStateException("business error");
        }
    }
}
