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

    /**
     * GDPR 하드 삭제 완료 알림 이메일.
     * 계정과 모든 개인 데이터가 영구 삭제되었음을 사용자에게 알린다.
     * 이메일 자체는 삭제되지 않은 별도 시스템(메일 서버)으로 발송한다.
     */
    @Async("emailExecutor")
    public void sendAccountHardDeletedEmail(String to) {
        send(to, "[SecureAI] 계정 영구 삭제 완료",
                "귀하의 SecureAI 계정과 모든 관련 데이터가 영구적으로 삭제되었습니다.\n\n"
                + "이 작업은 GDPR 제17조(삭제권)에 따라 처리되었습니다.\n\n"
                + "SecureAI 서비스를 이용해 주셔서 감사합니다.");
    }

    private void send(String to, String subject, String text) {
        try {
            SimpleMailMessage message = new SimpleMailMessage();
            message.setFrom(fromAddress);
            message.setTo(to);
            message.setSubject(subject);
            message.setText(text);
            mailSender.send(message);
            log.info("Email sent subject={}", subject);
        } catch (Exception e) {
            log.error("Email send failed subject={}", subject, e);
        }
    }
}
