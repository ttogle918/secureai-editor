package io.secureai.backend.global.converter;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.AttributeConverter;
import jakarta.persistence.Converter;

import java.util.ArrayList;
import java.util.List;

/**
 * List<String>을 JSON 문자열로 직렬화/역직렬화하는 JPA AttributeConverter.
 * PostgreSQL text 컬럼에 JSON 배열로 저장한다. (hibernate-types 의존성 없이 사용 가능)
 */
@Converter
public class StringListConverter implements AttributeConverter<List<String>, String> {

    private static final ObjectMapper MAPPER = new ObjectMapper();
    private static final TypeReference<List<String>> LIST_TYPE = new TypeReference<>() {};

    @Override
    public String convertToDatabaseColumn(List<String> attribute) {
        if (attribute == null || attribute.isEmpty()) {
            return "[]";
        }
        try {
            return MAPPER.writeValueAsString(attribute);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("List<String> to JSON 변환 실패", e);
        }
    }

    @Override
    public List<String> convertToEntityAttribute(String dbData) {
        if (dbData == null || dbData.isBlank()) {
            return new ArrayList<>();
        }
        try {
            return MAPPER.readValue(dbData, LIST_TYPE);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("JSON to List<String> 변환 실패: " + dbData, e);
        }
    }
}
