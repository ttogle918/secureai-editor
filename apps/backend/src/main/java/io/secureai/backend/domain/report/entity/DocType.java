package io.secureai.backend.domain.report.entity;

/** 보안 문서 유형. DB CHECK 제약과 일치해야 한다. */
public enum DocType {
    /** CISO 보고서 — 사내 경영진 보고용 */
    CISO,
    /** 행안부 SW개발보안 가이드 43개 항목 체크리스트 — 공공기관 제출용 */
    HANAFOS,
    /** ISMS-P 개발보안 통제항목 이행현황 — 인증 심사 증적용 */
    ISMS
}
