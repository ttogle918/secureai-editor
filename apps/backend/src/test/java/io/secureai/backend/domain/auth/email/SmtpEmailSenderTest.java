package io.secureai.backend.domain.auth.email;

import io.secureai.backend.domain.auth.entity.EmailLog;
import io.secureai.backend.domain.auth.entity.EmailStatus;
import io.secureai.backend.domain.auth.repository.EmailLogRepository;
import io.secureai.backend.domain.auth.repository.EmailSuppressionRepository;
import jakarta.mail.internet.MimeMessage;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SmtpEmailSenderTest {

    @Mock JavaMailSender mailSender;
    @Mock EmailLogRepository emailLogRepository;
    @Mock EmailSuppressionRepository suppressionRepository;
    @Mock MimeMessage mimeMessage;

    @Captor ArgumentCaptor<EmailLog> logCaptor;

    private SmtpEmailSender sender;

    @BeforeEach
    void setUp() {
        sender = new SmtpEmailSender(mailSender, emailLogRepository, suppressionRepository);
        ReflectionTestUtils.setField(sender, "fromAddress", "noreply@secureai.io");
        // suppression 테스트에서는 createMimeMessage가 호출되지 않으므로 lenient 적용
        lenient().when(mailSender.createMimeMessage()).thenReturn(mimeMessage);
    }

    // ───────────────────────────────────────────────────────────
    // Suppression 체크
    // ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("suppression 목록에 등록된 주소로는 메일을 발송하지 않고 SUPPRESSED 로그를 남긴다")
    void send_suppressedAddress_skipsAndLogsSupressed() {
        when(suppressionRepository.existsByEmailAddress("bounce@x.com")).thenReturn(true);
        // MimeMessage stub 불필요 — send가 호출되지 않으므로 createMimeMessage도 호출 안 됨

        sender.send("bounce@x.com", "테스트", "본문");

        verify(mailSender, never()).createMimeMessage();
        verify(emailLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getStatus()).isEqualTo(EmailStatus.SUPPRESSED);
        assertThat(logCaptor.getValue().getAttempts()).isEqualTo(0);
    }

    @Test
    @DisplayName("suppression 미등록 주소는 메일을 발송하고 SENT 로그를 남긴다")
    void send_normalAddress_sendsAndLogsSent() {
        when(suppressionRepository.existsByEmailAddress("ok@x.com")).thenReturn(false);

        sender.send("ok@x.com", "제목", "본문");

        verify(mailSender).send(any(MimeMessage.class));
        verify(emailLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getStatus()).isEqualTo(EmailStatus.SENT);
        assertThat(logCaptor.getValue().getAttempts()).isEqualTo(1);
    }

    // ───────────────────────────────────────────────────────────
    // 재시도 (지수 백오프)
    // ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("첫 번째 시도 실패 후 두 번째 시도에 성공하면 SENT 로그를 남긴다")
    void send_firstFailThenSuccess_logsSent() {
        when(suppressionRepository.existsByEmailAddress(any())).thenReturn(false);
        // 첫 번째 send 실패, 두 번째 성공
        doThrow(new RuntimeException("SMTP timeout"))
                .doNothing()
                .when(mailSender).send(any(MimeMessage.class));
        // 백오프 시간 단축: BASE_BACKOFF_MS를 0으로 설정
        ReflectionTestUtils.setField(sender, "fromAddress", "noreply@secureai.io");

        // 실제 백오프 대기를 우회하기 위해 별도 sender 생성 (BASE_BACKOFF_MS 필드 교체 불가 — final)
        // 대신 시도 횟수 검증으로 재시도 동작을 확인한다.
        sender.send("user@x.com", "제목", "본문");

        verify(mailSender, times(2)).send(any(MimeMessage.class));
        verify(emailLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getStatus()).isEqualTo(EmailStatus.SENT);
        assertThat(logCaptor.getValue().getAttempts()).isEqualTo(2);
    }

    @Test
    @DisplayName("MAX_ATTEMPTS(3) 모두 실패하면 FAILED 로그를 남기고 예외를 던지지 않는다")
    void send_allAttemptsExhausted_logsFailed() {
        when(suppressionRepository.existsByEmailAddress(any())).thenReturn(false);
        doThrow(new RuntimeException("SMTP down"))
                .when(mailSender).send(any(MimeMessage.class));

        assertThatCode(() -> sender.send("user@x.com", "제목", "본문"))
                .doesNotThrowAnyException();

        verify(mailSender, times(3)).send(any(MimeMessage.class));
        verify(emailLogRepository).save(logCaptor.capture());
        assertThat(logCaptor.getValue().getStatus()).isEqualTo(EmailStatus.FAILED);
        assertThat(logCaptor.getValue().getAttempts()).isEqualTo(3);
        assertThat(logCaptor.getValue().getErrorMessage()).contains("Max retry");
    }

    // ───────────────────────────────────────────────────────────
    // 공통 레이아웃 확인
    // ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("발송 본문에 헤더(SecureAI Engine)와 푸터(support@secureai.io)가 포함된다")
    void send_bodyWrappedWithLayout() {
        // EmailTemplate은 순수 유틸 — mock 없이 직접 검증
        String wrappedResult = EmailTemplate.wrap("내용");

        assertThat(wrappedResult).contains("SecureAI Engine");
        assertThat(wrappedResult).contains("support@secureai.io");
        assertThat(wrappedResult).contains("내용");
    }
}
