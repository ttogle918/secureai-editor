package io.secureai.backend.domain.auth.email;

/**
 * 공통 이메일 레이아웃 래퍼.
 *
 * 모든 발송 메일에 일관된 헤더/푸터를 적용한다.
 * 텍스트 기반으로 충분 — HTML 레이아웃은 향후 Sprint에서 추가 가능.
 */
public final class EmailTemplate {

    private static final String HEADER =
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            + "  SecureAI Engine\n"
            + "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n";

    private static final String FOOTER =
            "\n\n────────────────────────────────\n"
            + "본 메일은 발신 전용입니다. 문의: support@secureai.io\n"
            + "© SecureAI Engine. All rights reserved.";

    private EmailTemplate() {
        // 유틸 클래스 — 인스턴스 생성 금지
    }

    /**
     * 본문을 헤더/푸터로 감싸 일관된 레이아웃을 반환한다.
     */
    public static String wrap(String body) {
        return HEADER + body + FOOTER;
    }
}
