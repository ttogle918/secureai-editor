package io.secureai.backend.domain.auth.email;

import io.secureai.backend.domain.auth.entity.EmailLog;
import io.secureai.backend.domain.auth.entity.EmailStatus;
import io.secureai.backend.domain.auth.repository.EmailLogRepository;
import io.secureai.backend.domain.auth.repository.EmailSuppressionRepository;
import jakarta.mail.MessagingException;
import jakarta.mail.internet.MimeMessage;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.mail.javamail.MimeMessageHelper;
import org.springframework.stereotype.Component;

/**
 * SMTP 기반 이메일 발송 전략.
 *
 * JavaMailSender를 위임받아 발송하며, 아래 책임을 갖는다:
 *  1) 발송 전 suppression 조회 → 등록된 주소면 SUPPRESSED 로그 후 스킵
 *  2) 발송 실패 시 지수 백오프로 최대 MAX_ATTEMPTS회 재시도
 *  3) 발송 결과(SENT/FAILED/SUPPRESSED)를 email_log에 기록
 */
@Slf4j
@Component
@RequiredArgsConstructor
public class SmtpEmailSender implements EmailSender {

    private static final String PROVIDER = "smtp";
    private static final int MAX_ATTEMPTS = 3;
    private static final long BASE_BACKOFF_MS = 1_000L;

    private final JavaMailSender mailSender;
    private final EmailLogRepository emailLogRepository;
    private final EmailSuppressionRepository suppressionRepository;

    @Value("${spring.mail.username:noreply@secureai.io}")
    private String fromAddress;

    @Override
    public void send(String to, String subject, String body) {
        sendWithAttachment(to, subject, body, null, null);
    }

    @Override
    public void sendWithAttachment(String to, String subject, String body,
                                   String attachmentName, byte[] attachmentData) {
        if (isSuppressed(to)) {
            recordLog(to, subject, EmailStatus.SUPPRESSED, 0, null);
            log.info("[email] suppressed to={} subject={}", to, subject);
            return;
        }

        String wrappedBody = EmailTemplate.wrap(body);
        attemptSendWithRetry(to, subject, wrappedBody, attachmentName, attachmentData);
    }

    private boolean isSuppressed(String to) {
        return suppressionRepository.existsByEmailAddress(to);
    }

    private void attemptSendWithRetry(String to, String subject, String body,
                                       String attachmentName, byte[] attachmentData) {
        int attempts = 0;
        long backoffMs = BASE_BACKOFF_MS;

        while (attempts < MAX_ATTEMPTS) {
            attempts++;
            try {
                doSend(to, subject, body, attachmentName, attachmentData);
                recordLog(to, subject, EmailStatus.SENT, attempts, null);
                log.info("[email] sent to={} subject={} attempts={}", to, subject, attempts);
                return;
            } catch (Exception e) {
                log.warn("[email] attempt={} failed to={} reason={}", attempts, to, e.getMessage());
                if (attempts < MAX_ATTEMPTS) {
                    sleepBackoff(backoffMs);
                    backoffMs *= 2;
                }
            }
        }

        recordLog(to, subject, EmailStatus.FAILED, attempts, "Max retry exhausted");
        log.error("[email] failed after {} attempts to={} subject={}", MAX_ATTEMPTS, to, subject);
    }

    private void doSend(String to, String subject, String body,
                        String attachmentName, byte[] attachmentData) throws MessagingException {
        MimeMessage message = mailSender.createMimeMessage();
        boolean multipart = attachmentData != null;
        MimeMessageHelper helper = new MimeMessageHelper(message, multipart, "UTF-8");
        helper.setFrom(fromAddress);
        helper.setTo(to);
        helper.setSubject(subject);
        helper.setText(body);
        if (multipart) {
            helper.addAttachment(attachmentName, () -> new java.io.ByteArrayInputStream(attachmentData));
        }
        mailSender.send(message);
    }

    private void recordLog(String to, String subject, EmailStatus status, int attempts, String errorMessage) {
        try {
            emailLogRepository.save(
                EmailLog.builder()
                    .toAddress(to)
                    .subject(subject)
                    .status(status)
                    .provider(PROVIDER)
                    .attempts(attempts)
                    .errorMessage(errorMessage)
                    .build()
            );
        } catch (Exception e) {
            // 로그 기록 실패가 발송 흐름에 영향 주지 않도록 방어
            log.warn("[email] log record failed: {}", e.getMessage());
        }
    }

    private void sleepBackoff(long ms) {
        try {
            Thread.sleep(ms);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }
}
