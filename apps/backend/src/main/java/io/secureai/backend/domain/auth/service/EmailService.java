package io.secureai.backend.domain.auth.service;

import io.secureai.backend.domain.auth.email.EmailSender;
import lombok.RequiredArgsConstructor;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

/**
 * 트랜잭션 이메일 발송 서비스.
 *
 * 메일 발송 채널은 EmailSender(Strategy)에 위임한다.
 * suppression 체크·재시도·발송 로그는 EmailSender 구현체 책임 (SRP).
 *
 * 기존 6개 메서드 시그니처·동작을 그대로 유지한다 (하위 호환성).
 */
@Service
@RequiredArgsConstructor
public class EmailService {

    private final EmailSender emailSender;

    // 메일 본문에 포함될 프론트엔드 URL — 설정값 의존성은 EmailService가 보유
    @org.springframework.beans.factory.annotation.Value("${secureai.frontend.url}")
    private String frontendUrl;

    @Async("emailExecutor")
    public void sendVerificationEmail(String to, String token) {
        String link = "%s/auth/verify-email?token=%s".formatted(frontendUrl, token);
        emailSender.send(to,
                "[SecureAI] 이메일 인증을 완료해주세요",
                "아래 링크를 클릭하여 이메일 인증을 완료하세요.\n\n" + link
                + "\n\n링크는 24시간 동안 유효합니다.");
    }

    @Async("emailExecutor")
    public void sendPasswordResetEmail(String to, String token) {
        String link = "%s/auth/reset-password?token=%s".formatted(frontendUrl, token);
        emailSender.send(to,
                "[SecureAI] 비밀번호 재설정",
                "아래 링크를 클릭하여 비밀번호를 재설정하세요.\n\n" + link
                + "\n\n링크는 1시간 동안 유효합니다.");
    }

    @Async("emailExecutor")
    public void sendOrgInvitation(String to, String token, String orgName) {
        String link = "%s/invite/%s".formatted(frontendUrl, token);
        emailSender.send(to,
                "[SecureAI] %s 조직 초대".formatted(orgName),
                "%s 조직에 초대되었습니다.\n\n아래 링크를 클릭하여 초대를 수락하세요.\n\n%s"
                        .formatted(orgName, link)
                + "\n\n링크는 72시간 동안 유효합니다.");
    }

    /**
     * 야간 자동 스캔 완료 알림 이메일.
     *
     * @param to          수신자 이메일 (프로젝트 소유자)
     * @param projectName 스캔된 프로젝트 이름
     * @param summary     스캔 결과 요약
     */
    @Async("emailExecutor")
    public void sendNightlyScanResultEmail(String to, String projectName, String summary) {
        emailSender.send(to,
                "[SecureAI] 야간 자동 스캔 완료 — " + projectName,
                "프로젝트 [" + projectName + "]의 야간 자동 스캔이 완료되었습니다.\n\n"
                + "결과 요약: " + summary + "\n\n"
                + "자세한 내용은 SecureAI 대시보드에서 확인하세요.");
    }

    /**
     * GDPR 하드 삭제 완료 알림 이메일.
     * 계정과 모든 개인 데이터가 영구 삭제되었음을 사용자에게 알린다.
     */
    @Async("emailExecutor")
    public void sendAccountHardDeletedEmail(String to) {
        emailSender.send(to,
                "[SecureAI] 계정 영구 삭제 완료",
                "귀하의 SecureAI 계정과 모든 관련 데이터가 영구적으로 삭제되었습니다.\n\n"
                + "이 작업은 GDPR 제17조(삭제권)에 따라 처리되었습니다.\n\n"
                + "SecureAI 서비스를 이용해 주셔서 감사합니다.");
    }

    /**
     * 보안 리포트 이메일 전송 — 다운로드 링크(본문) + PDF 첨부.
     *
     * @param to           수신자 이메일
     * @param fileName     첨부 파일명 (예: report-xxx.pdf)
     * @param downloadLink 24시간 유효 다운로드 URL
     * @param pdfBytes     PDF 바이트 배열 (null이면 링크만 전송)
     */
    @Async("emailExecutor")
    public void sendReportEmail(String to, String fileName, String downloadLink, byte[] pdfBytes) {
        emailSender.sendWithAttachment(
                to,
                "[SecureAI] 보안 분석 리포트가 준비되었습니다",
                "보안 분석 리포트 생성이 완료되었습니다.\n\n"
                + "▶ 다운로드 링크 (24시간 유효):\n" + downloadLink + "\n\n"
                + "PDF 파일을 첨부 파일로도 함께 보내드립니다.",
                pdfBytes != null ? fileName : null,
                pdfBytes
        );
    }
}
