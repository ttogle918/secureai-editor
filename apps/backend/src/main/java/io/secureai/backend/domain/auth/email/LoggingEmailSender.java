package io.secureai.backend.domain.auth.email;

import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

/**
 * 개발/로컬 전용 이메일 발송기 — 실제 SMTP 없이 메일 내용을 로그로 출력한다.
 *
 * 활성화: app.email.provider=log (기본값은 smtp → SmtpEmailSender 사용).
 * 목적: SMTP 자격증명이 없는 로컬/데모 환경에서 이메일 인증 링크 등을 콘솔에서 확인하기 위함.
 *
 * ⚠️ 운영 환경 사용 금지: 본문에는 인증 토큰이 포함된 링크가 들어가며 로그로 남는다.
 *    프로덕션은 기본값(smtp)을 쓰므로 이 빈은 생성되지 않는다.
 */
@Slf4j
@Component
@ConditionalOnProperty(prefix = "app.email", name = "provider", havingValue = "log")
public class LoggingEmailSender implements EmailSender {

    public LoggingEmailSender() {
        log.warn("[email] LoggingEmailSender 활성화 — 개발 전용. 메일이 실제로 발송되지 않고 "
                + "로그로만 출력됩니다. (운영 사용 금지)");
    }

    @Override
    public void send(String to, String subject, String body) {
        log.info("[email:DEV] to={} subject={}\n----- BODY -----\n{}\n----------------", to, subject, body);
    }

    @Override
    public void sendWithAttachment(String to, String subject, String body,
                                   String attachmentName, byte[] attachmentData) {
        int size = attachmentData != null ? attachmentData.length : 0;
        log.info("[email:DEV] to={} subject={} attachment={}({} bytes)\n----- BODY -----\n{}\n----------------",
                to, subject, attachmentName, size, body);
    }
}
