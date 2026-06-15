package io.secureai.backend.domain.auth.email;

/**
 * 이메일 발송 전략 인터페이스.
 *
 * SMTP (JavaMailSender) ↔ 외부 프로바이더 전환을 런타임 설정으로 가능하게 한다.
 * 발송 전 suppression 조회 + 발송 후 email_log 기록은 SmtpEmailSender가 담당한다.
 */
public interface EmailSender {

    /**
     * 일반 텍스트 메일 발송.
     *
     * @param to      수신자 이메일 주소
     * @param subject 메일 제목
     * @param body    메일 본문 (공통 레이아웃 래핑 전)
     */
    void send(String to, String subject, String body);

    /**
     * 첨부파일 포함 메일 발송.
     *
     * @param to             수신자 이메일 주소
     * @param subject        메일 제목
     * @param body           메일 본문
     * @param attachmentName 첨부 파일명 (null이면 첨부 없음)
     * @param attachmentData 첨부 파일 바이트 (null이면 첨부 없음)
     */
    void sendWithAttachment(String to, String subject, String body,
                            String attachmentName, byte[] attachmentData);
}
