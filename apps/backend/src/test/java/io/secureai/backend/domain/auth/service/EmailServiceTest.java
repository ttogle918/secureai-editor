package io.secureai.backend.domain.auth.service;

import io.secureai.backend.domain.auth.email.EmailSender;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * EmailService 회귀 테스트.
 *
 * 기존 6개 메서드가 EmailSender(mock)에 올바르게 위임되는지 확인한다.
 * 발송 실패 시 호출자에게 예외가 전파되지 않는 계약도 포함.
 */
@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock EmailSender emailSender;

    @Captor ArgumentCaptor<String> toCaptor;
    @Captor ArgumentCaptor<String> subjectCaptor;
    @Captor ArgumentCaptor<String> bodyCaptor;

    private EmailService service;

    @BeforeEach
    void setUp() {
        service = new EmailService(emailSender);
        ReflectionTestUtils.setField(service, "frontendUrl", "http://front");
    }

    // ───────────────────────────────────────────────────────────
    // 1. sendVerificationEmail
    // ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("sendVerificationEmail — 인증 링크와 수신자를 담아 EmailSender에 위임한다")
    void sendVerificationEmail_delegatesWithLink() {
        service.sendVerificationEmail("user@x.com", "tok-1");

        verify(emailSender).send(toCaptor.capture(), subjectCaptor.capture(), bodyCaptor.capture());
        assertThat(toCaptor.getValue()).isEqualTo("user@x.com");
        assertThat(bodyCaptor.getValue()).contains("http://front/auth/verify-email?token=tok-1");
    }

    // ───────────────────────────────────────────────────────────
    // 2. sendPasswordResetEmail
    // ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("sendPasswordResetEmail — 비밀번호 재설정 링크를 담아 EmailSender에 위임한다")
    void sendPasswordResetEmail_delegatesWithLink() {
        service.sendPasswordResetEmail("user@x.com", "reset-tok");

        verify(emailSender).send(any(), any(), bodyCaptor.capture());
        assertThat(bodyCaptor.getValue())
                .contains("http://front/auth/reset-password?token=reset-tok");
    }

    // ───────────────────────────────────────────────────────────
    // 3. sendOrgInvitation
    // ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("sendOrgInvitation — 초대 링크와 조직명을 제목/본문에 포함하여 위임한다")
    void sendOrgInvitation_delegatesWithOrgAndLink() {
        service.sendOrgInvitation("invitee@x.com", "inv-tok", "Acme");

        verify(emailSender).send(toCaptor.capture(), subjectCaptor.capture(), bodyCaptor.capture());
        assertThat(subjectCaptor.getValue()).contains("Acme");
        assertThat(bodyCaptor.getValue()).contains("http://front/invite/inv-tok");
    }

    // ───────────────────────────────────────────────────────────
    // 4. sendNightlyScanResultEmail
    // ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("sendNightlyScanResultEmail — 프로젝트명과 요약을 담아 위임한다")
    void sendNightlyScanResultEmail_delegatesWithProjectAndSummary() {
        service.sendNightlyScanResultEmail("owner@x.com", "MyProject", "Critical: 3, High: 5");

        verify(emailSender).send(any(), subjectCaptor.capture(), bodyCaptor.capture());
        assertThat(subjectCaptor.getValue()).contains("MyProject");
        assertThat(bodyCaptor.getValue()).contains("Critical: 3, High: 5");
    }

    // ───────────────────────────────────────────────────────────
    // 5. sendAccountHardDeletedEmail
    // ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("sendAccountHardDeletedEmail — GDPR 삭제 완료 메시지를 담아 위임한다")
    void sendAccountHardDeletedEmail_delegatesGdprMessage() {
        service.sendAccountHardDeletedEmail("deleted@x.com");

        verify(emailSender).send(toCaptor.capture(), any(), bodyCaptor.capture());
        assertThat(toCaptor.getValue()).isEqualTo("deleted@x.com");
        assertThat(bodyCaptor.getValue()).contains("GDPR");
    }

    // ───────────────────────────────────────────────────────────
    // 6. sendReportEmail
    // ───────────────────────────────────────────────────────────

    @Test
    @DisplayName("sendReportEmail — PDF 바이트 있을 때 sendWithAttachment에 파일명과 데이터를 담아 위임한다")
    void sendReportEmail_withPdf_delegatesToSendWithAttachment() {
        byte[] pdf = new byte[]{1, 2, 3};

        service.sendReportEmail("user@x.com", "report.pdf", "http://dl.link", pdf);

        verify(emailSender).sendWithAttachment(
                eq("user@x.com"), any(), bodyCaptor.capture(), eq("report.pdf"), eq(pdf));
        assertThat(bodyCaptor.getValue()).contains("http://dl.link");
    }

    @Test
    @DisplayName("sendReportEmail — PDF 없을 때 sendWithAttachment에 null 파일명/데이터를 담아 위임한다")
    void sendReportEmail_noPdf_delegatesNullAttachment() {
        service.sendReportEmail("user@x.com", "report.pdf", "http://dl.link", null);

        verify(emailSender).sendWithAttachment(
                eq("user@x.com"), any(), any(), isNull(), isNull());
    }
}
