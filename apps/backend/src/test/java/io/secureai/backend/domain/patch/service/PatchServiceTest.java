package io.secureai.backend.domain.patch.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.patch.dto.PatchSuggestionResponse;
import io.secureai.backend.domain.patch.dto.SavePatchResultsRequest;
import io.secureai.backend.domain.patch.entity.PatchSuggestion;
import io.secureai.backend.domain.patch.repository.PatchSuggestionRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PatchServiceTest {

    @Mock PatchSuggestionRepository patchRepository;
    @Mock AnalysisSessionRepository sessionRepository;
    @Mock UserRepository userRepository;

    @InjectMocks PatchService patchService;

    private UUID sessionId;
    private UUID projectId;
    private UUID userId;
    private AnalysisSession session;
    private User user;

    @BeforeEach
    void setUp() {
        sessionId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        userId    = UUID.randomUUID();

        session = AnalysisSession.builder().build();
        ReflectionTestUtils.setField(session, "id", sessionId);

        user = User.builder().build();
        ReflectionTestUtils.setField(user, "id", userId);
    }

    // -----------------------------------------------------------------------
    // TC-1: savePatchResults → PatchSuggestion 저장
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("savePatchResults — 패치 아이템 목록이 저장된다")
    void savePatchResults_saves_patch_suggestions() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        when(patchRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        SavePatchResultsRequest req = new SavePatchResultsRequest(
                sessionId, projectId,
                List.of(
                        new SavePatchResultsRequest.PatchItem(
                                "src/Dao.java", "SQL_INJECTION",
                                "old code", "safe code",
                                "--- a\n+++ b\n@@ -1 +1 @@\n-old\n+safe\n",
                                "Used PreparedStatement.", "secureai:patch:SQL_INJECTION:java"
                        )
                )
        );

        int saved = patchService.savePatchResults(req);

        assertThat(saved).isEqualTo(1);

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<PatchSuggestion>> captor = ArgumentCaptor.forClass(List.class);
        verify(patchRepository).saveAll(captor.capture());

        PatchSuggestion patch = captor.getValue().get(0);
        assertThat(patch.getVulnType()).isEqualTo("SQL_INJECTION");
        assertThat(patch.getFilePath()).isEqualTo("src/Dao.java");
        assertThat(patch.getPatchedSnippet()).isEqualTo("safe code");
        assertThat(patch.getCacheKey()).isEqualTo("secureai:patch:SQL_INJECTION:java");
    }

    // -----------------------------------------------------------------------
    // TC-2: applyPatch → is_applied=true, applied_by 업데이트
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("applyPatch — isApplied=true, appliedBy 가 설정된다")
    void applyPatch_marks_patch_as_applied() {
        UUID patchId = UUID.randomUUID();

        PatchSuggestion patch = PatchSuggestion.builder()
                .session(session)
                .filePath("src/Dao.java")
                .vulnType("SQL_INJECTION")
                .build();
        ReflectionTestUtils.setField(patch, "id", patchId);

        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(patchRepository.findById(patchId)).thenReturn(Optional.of(patch));

        PatchSuggestionResponse response = patchService.applyPatch(userId, patchId);

        assertThat(response.isApplied()).isTrue();
        assertThat(response.appliedBy()).isEqualTo(userId);
        assertThat(response.appliedAt()).isNotNull();
    }

    // -----------------------------------------------------------------------
    // TC-3: applyPatch — 존재하지 않는 patchId → BusinessException
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("applyPatch — 존재하지 않는 패치 ID는 PATCH_NOT_FOUND 예외를 발생시킨다")
    void applyPatch_unknown_id_throws_patch_not_found() {
        UUID unknownId = UUID.randomUUID();
        when(userRepository.findById(userId)).thenReturn(Optional.of(user));
        when(patchRepository.findById(unknownId)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> patchService.applyPatch(userId, unknownId))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.PATCH_NOT_FOUND));
    }

    // -----------------------------------------------------------------------
    // TC-4: savePatchResults — patches가 null이면 0 반환
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("savePatchResults — patches 목록이 null이면 저장 없이 0을 반환한다")
    void savePatchResults_null_patches_returns_zero() {
        when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));

        SavePatchResultsRequest req = new SavePatchResultsRequest(sessionId, projectId, null);
        int saved = patchService.savePatchResults(req);

        assertThat(saved).isZero();
        verify(patchRepository, never()).saveAll(any());
    }

    // -----------------------------------------------------------------------
    // TC-5: savePatchResults — 존재하지 않는 sessionId → BusinessException
    // -----------------------------------------------------------------------

    @Test
    @DisplayName("savePatchResults — 존재하지 않는 세션 ID는 SESSION_NOT_FOUND 예외를 발생시킨다")
    void savePatchResults_unknown_session_throws_session_not_found() {
        UUID unknownSession = UUID.randomUUID();
        when(sessionRepository.findById(unknownSession)).thenReturn(Optional.empty());

        SavePatchResultsRequest req = new SavePatchResultsRequest(unknownSession, projectId, List.of());

        assertThatThrownBy(() -> patchService.savePatchResults(req))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.SESSION_NOT_FOUND));
    }
}
