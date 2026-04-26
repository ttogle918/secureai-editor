package io.secureai.backend.domain.analysis.dto;

import com.fasterxml.jackson.annotation.JsonInclude;

import java.util.UUID;

@JsonInclude(JsonInclude.Include.NON_NULL)
public record ProgressEvent(
        UUID sessionId,
        String type,     // started / node_complete / progress / completed / error
        String node,
        String file,
        Integer current,
        Integer total,
        String message
) {
    public static ProgressEvent of(UUID sessionId, String type) {
        return new ProgressEvent(sessionId, type, null, null, null, null, null);
    }

    public static ProgressEvent error(UUID sessionId, String message) {
        return new ProgressEvent(sessionId, "error", null, null, null, null, message);
    }
}
