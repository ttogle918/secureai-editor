package io.secureai.backend.domain.analysis.controller;

import io.secureai.backend.domain.analysis.service.AiAgentClient;
import io.secureai.backend.domain.user.service.UserService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TranslateControllerTest {

    @Mock AiAgentClient aiAgentClient;
    @Mock UserService userService;

    private TranslateController controller;
    private final UUID userId = UUID.randomUUID();

    @BeforeEach
    void setUp() {
        controller = new TranslateController(aiAgentClient, userService);
    }

    @Test
    @DisplayName("translate — 지정한 targetLang 과 사용자 API 키로 번역을 위임한다")
    void translate_usesTargetLangAndUserKey() {
        when(userService.getAnalysisSettings(userId))
                .thenReturn(new UserService.UserAnalysisSettings("model", "sk-user"));
        when(aiAgentClient.translate("hello", "ja", "sk-user")).thenReturn("こんにちは");

        var response = controller.translate(userId,
                new TranslateController.TranslateRequest("hello", "ja"));

        assertThat(response.getStatusCode().value()).isEqualTo(200);
        assertThat(response.getBody().getData().translatedText()).isEqualTo("こんにちは");
    }

    @Test
    @DisplayName("translate — targetLang 이 없으면 기본값 ko 로 번역한다")
    void translate_defaultsToKorean() {
        when(userService.getAnalysisSettings(userId))
                .thenReturn(new UserService.UserAnalysisSettings("model", null));
        when(aiAgentClient.translate("hello", "ko", null)).thenReturn("안녕");

        var response = controller.translate(userId,
                new TranslateController.TranslateRequest("hello", null));

        assertThat(response.getBody().getData().translatedText()).isEqualTo("안녕");
        verify(aiAgentClient).translate("hello", "ko", null);
    }
}
