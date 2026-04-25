package io.secureai.backend.global.response;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.Getter;

import java.time.OffsetDateTime;
import java.util.UUID;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class ApiResponse<T> {

    private final boolean success;
    private final T data;
    private final Meta meta;
    private final ErrorInfo error;

    private ApiResponse(boolean success, T data, Meta meta, ErrorInfo error) {
        this.success = success;
        this.data = data;
        this.meta = meta;
        this.error = error;
    }

    public static <T> ApiResponse<T> success(T data) {
        return new ApiResponse<>(true, data, new Meta(), null);
    }

    public static <T> ApiResponse<T> error(String code, String message, String detail) {
        return new ApiResponse<>(false, null, null, new ErrorInfo(code, message, detail));
    }

    @Getter
    public static class Meta {
        private final String requestId = UUID.randomUUID().toString();
        private final String timestamp = OffsetDateTime.now().toString();
        private final String version = "1.0";
    }

    @Getter
    public static class ErrorInfo {
        private final String code;
        private final String message;
        private final String detail;
        private final String timestamp = OffsetDateTime.now().toString();

        ErrorInfo(String code, String message, String detail) {
            this.code = code;
            this.message = message;
            this.detail = detail;
        }
    }
}
