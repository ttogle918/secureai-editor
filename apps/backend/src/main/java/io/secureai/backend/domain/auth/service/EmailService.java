package io.secureai.backend.domain.auth.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

@Slf4j
@Service
@RequiredArgsConstructor
public class EmailService {

    private final JavaMailSender mailSender;

    @Value("${secureai.frontend.url}")
    private String frontendUrl;

    @Value("${spring.mail.username:noreply@secureai.io}")
    private String fromAddress;

    @Async("emailExecutor")
    public void sendVerificationEmail(String to, String token) {
        String link = "%s/auth/verify-email?token=%s".formatted(frontendUrl, token);
        send(to, "[SecureAI] 이메일 인증을 완료해주세요",
                "아래 링크를 클릭하여 이메일 인증을 완료하세요.\n\n" + link + "\n\n링크는 24시간 동안 유효합니다.");
    }

    @Async("emailExecutor")
    public void sendPasswordResetEmail(String to, String token) {
        String link = "%s/auth/reset-password?token=%s".formatted(frontendUrl, token);
        send(to, "[SecureAI] 비밀번호 재설정",
                "아래 링크를 클릭하여 비밀번호를 재설정하세요.\n\n" + link + "\n\n링크는 1시간 동안 유효합니다.");
    }

    @Async("emailExecutor")
    public void sendOrgInvitation(String to, String token, String orgName) {
        String link = "%s/invite/%s".formatted(frontendUrl, token);
        send(to, "[SecureAI] %s 조직 초대".formatted(orgName),
                "%s 조직에 초대되었습니다.\n\n아래 링크를 클릭하여 초대를 수락하세요.\n\n%s\n\n링크는 72시간 동안 유효합니다."
                        .formatted(orgName, link));
    }

    private void send(String to, String subject, String text) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            mailSender.send(message);
            log.info("Email sent to={} subject={}", to, subject);
        } catch (Exception e) {
            log.error("Email send failed to={} subject={}", to, subject, e);
        }
    }
}
