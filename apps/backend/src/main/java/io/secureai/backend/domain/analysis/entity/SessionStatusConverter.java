package io.secureai.backend.domain.analysis.entity;

import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

/** DB VARCHAR(소문자) ↔ SessionStatus(대문자 enum) 변환. Flyway 마이그레이션 없이 기존 데이터 호환. */
@Converter(autoApply = false)
public class SessionStatusConverter implements AttributeConverter<SessionStatus, String> {

    @Override
    public String convertToDatabaseColumn(SessionStatus status) {
        return status != null ? status.toDbValue() : null;
    }

    @Override
    public SessionStatus convertToEntityAttribute(String dbValue) {
        return SessionStatus.fromDbValue(dbValue);
    }
}
