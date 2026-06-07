package io.secureai.backend.domain.auth.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Captor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.test.util.ReflectionTestUtils;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class EmailServiceTest {

    @Mock JavaMailSender mailSender;

    @Captor ArgumentCaptor<SimpleMailMessage> messageCaptor;

    private EmailService service;

    @BeforeEach
    void setUp() {
        service = new EmailService(mailSender);
        ReflectionTestUtils.setField(service, "frontendUrl", "http://front");
        ReflectionTestUtils.setField(service, "fromAddress", "noreply@secureai.io");
    }

    @Test
    @DisplayName("sendVerificationEmail — 인증 링크와 수신자를 담아 메일을 전송한다")
    void sendVerificationEmail_buildsLink() {
        service.sendVerificationEmail("user@x.com", "tok-1");

        verify(mailSender).send(messageCaptor.capture());
        SimpleMailMessage msg = messageCaptor.getValue();
        assertThat(msg.getTo()).containsExactly("user@x.com");
        assertThat(msg.getFrom()).isEqualTo("noreply@secureai.io");
        assertThat(msg.getText()).contains("http://front/auth/verify-email?token=tok-1");
    }

    @Test
    @DisplayName("sendPasswordResetEmail — 비밀번호 재설정 링크를 담아 전송한다")
    void sendPasswordResetEmail_buildsLink() {
        service.sendPasswordResetEmail("user@x.com", "reset-tok");

        verify(mailSender).send(messageCaptor.capture());
        assertThat(messageCaptor.getValue().getText())
                .contains("http://front/auth/reset-password?token=reset-tok");
    }

    @Test
    @DisplayName("sendOrgInvitation — 초대 링크와 조직명을 제목/본문에 포함한다")
    void sendOrgInvitation_buildsLinkAndSubject() {
        service.sendOrgInvitation("invitee@x.com", "inv-tok", "Acme");

        verify(mailSender).send(messageCaptor.capture());
        SimpleMailMessage msg = messageCaptor.getValue();
        assertThat(msg.getSubject()).contains("Acme");
        assertThat(msg.getText()).contains("http://front/invite/inv-tok");
    }

    @Test
    @DisplayName("send 실패가 호출자에게 전파되지 않는다 (메일 오류는 흐름을 막지 않는다)")
    void sendFailure_isSwallowed() {
        doThrow(new RuntimeException("smtp down")).when(mailSender).send(any(SimpleMailMessage.class));

        assertThatCode(() -> service.sendVerificationEmail("user@x.com", "tok"))
                .doesNotThrowAnyException();
    }
}
