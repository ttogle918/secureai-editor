package io.secureai.backend.domain.analysis.entity;

public enum SessionStatus {
    PENDING,
    RUNNING,
    COMPLETED,
    ERROR,
    INTERRUPTED,
    CANCELLED;

    /** DB VARCHAR 컬럼에 저장되는 소문자 값. */
    public String toDbValue() {
        return name().toLowerCase();
    }

    public static SessionStatus fromDbValue(String value) {
        if (value == null) return PENDING;
        return valueOf(value.toUpperCase());
    }
}
