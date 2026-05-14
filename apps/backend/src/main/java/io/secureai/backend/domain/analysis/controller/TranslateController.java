package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.service.AiAgentClient;
import io.secureai.backend.domain.user.service.UserService;
import io.secureai.backend.global.response.ApiResponse;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/translate")
@RequiredArgsConstructor
public class TranslateController {

    private final AiAgentClient aiAgentClient;
    private final UserService userService;

    public record TranslateRequest(
        @NotBlank @Size(max = 4000) String text,
        String targetLang
    ) {}

    public record TranslateResult(String translatedText) {}

    @PostMapping
    public ResponseEntity<ApiResponse<TranslateResult>> translate(
            @AuthenticationPrincipal UUID userId,
            @Valid @RequestBody TranslateRequest req) {

        UserService.UserAnalysisSettings settings = userService.getAnalysisSettings(userId);
        String lang = req.targetLang() != null ? req.targetLang() : "ko";

        String translated = aiAgentClient.translate(req.text(), lang, settings.apiKey());
        return ResponseEntity.ok(ApiResponse.success(new TranslateResult(translated)));
    }
}
