package io.secureai.backend.global.aop;

import org.springframework.stereotype.Component;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.format.DateTimeFormatter;

/**
 * 감사 로그 해시 계산 전용 컴포넌트 (SRP).
 *
 * 결정론적 canonical payload:
 *   actor_id|action|resource|outcome|created_at (ISO-8601 UTC)
 * 각 필드가 null이면 빈 문자열("") 대체 — 필드 순서는 절대 변경 금지.
 * 순서 변경 시 기존 체인 전체가 무효화된다.
 */
@Component
public class AuditLogHashService {

    /** genesis 로그의 prev_hash 고정값 (64자 '0'). */
    public static final String GENESIS_PREV_HASH = "0".repeat(64);

    private static final String HASH_ALGORITHM = "SHA-256";
    private static final DateTimeFormatter ISO_UTC = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    /**
     * 엔트리의 SHA-256 해시를 계산한다.
     *
     * @param prevHash     직전 엔트리의 current_hash (genesis인 경우 {@link #GENESIS_PREV_HASH})
     * @param entry        해시를 계산할 엔트리 (createdAt이 반드시 설정되어 있어야 한다)
     * @return hex 소문자 64자 문자열
     */
    public String compute(String prevHash, AuditLogEntry entry) {
        String payload = buildCanonicalPayload(entry);
        String input = prevHash + payload;
        return sha256Hex(input);
    }

    /**
     * 결정론적 canonical payload 직렬화.
     * 필드 추가/변경 시 체인이 깨지므로 이 순서를 절대 변경하지 않는다.
     */
    String buildCanonicalPayload(AuditLogEntry entry) {
        return nullSafe(entry.getActorId())
                + "|" + nullSafe(entry.getAction())
                + "|" + nullSafe(entry.getResource())
                + "|" + nullSafe(entry.getOutcome())
                + "|" + (entry.getCreatedAt() != null ? ISO_UTC.format(entry.getCreatedAt()) : "");
    }

    private String nullSafe(Object value) {
        return value == null ? "" : value.toString();
    }

    private String sha256Hex(String input) {
        try {
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            byte[] hash = digest.digest(input.getBytes(StandardCharsets.UTF_8));
            return bytesToHex(hash);
        } catch (NoSuchAlgorithmException e) {
            // SHA-256은 JVM 필수 알고리즘 — 실제로 발생하지 않는다
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder(64);
        for (byte b : bytes) {
            sb.append(String.format("%02x", b));
        }
        return sb.toString();
    }
}
