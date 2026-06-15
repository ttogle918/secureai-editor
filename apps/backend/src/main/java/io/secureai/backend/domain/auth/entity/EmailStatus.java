package io.secureai.backend.domain.auth.entity;

/** 이메일 발송 결과 상태. */
public enum EmailStatus {
    SENT,
    FAILED,
    SUPPRESSED
}
