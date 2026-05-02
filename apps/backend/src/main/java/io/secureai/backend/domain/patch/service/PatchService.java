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
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
public class PatchService {

    private final PatchSuggestionRepository patchRepository;
    private final AnalysisSessionRepository sessionRepository;
    private final UserRepository userRepository;

    @Transactional
    public int savePatchResults(SavePatchResultsRequest req) {
        AnalysisSession session = sessionRepository.findById(req.sessionId())
                .orElseThrow(() -> new BusinessException(ErrorCode.SESSION_NOT_FOUND));

        List<SavePatchResultsRequest.PatchItem> items =
                req.patches() != null ? req.patches() : List.of();

        List<PatchSuggestion> toSave = new ArrayList<>();
        for (SavePatchResultsRequest.PatchItem item : items) {
            toSave.add(PatchSuggestion.builder()
                    .session(session)
                    .filePath(item.filePath())
                    .vulnType(item.vulnType())
                    .originalSnippet(item.originalSnippet())
                    .patchedSnippet(item.patchedSnippet())
                    .unifiedDiff(item.unifiedDiff())
                    .explanation(item.explanation())
                    .cacheKey(item.cacheKey())
                    .build());
        }

        if (!toSave.isEmpty()) {
            patchRepository.saveAll(toSave);
            log.info("[patch] saved={} sessionId={}", toSave.size(), req.sessionId());
        }
        return toSave.size();
    }

    @Transactional
    public PatchSuggestionResponse applyPatch(UUID userId, UUID patchId) {
        User user = userRepository.findById(userId)
                .orElseThrow(() -> new BusinessException(ErrorCode.USER_NOT_FOUND));

        PatchSuggestion patch = patchRepository.findById(patchId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PATCH_NOT_FOUND));

        patch.apply(user);
        return PatchSuggestionResponse.from(patch);
    }

    @Transactional(readOnly = true)
    public List<PatchSuggestionResponse> listBySession(UUID sessionId) {
        return patchRepository.findBySession_Id(sessionId).stream()
                .map(PatchSuggestionResponse::from)
                .toList();
    }
}
