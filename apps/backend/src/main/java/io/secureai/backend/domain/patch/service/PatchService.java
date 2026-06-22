package io.secureai.backend.domain.patch.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.patch.dto.PatchExampleItem;
import io.secureai.backend.domain.patch.dto.PatchSuggestionResponse;
import io.secureai.backend.domain.patch.dto.PatchVerificationRequest;
import io.secureai.backend.domain.patch.dto.SavePatchResultsRequest;
import io.secureai.backend.domain.patch.entity.PatchSuggestion;
import io.secureai.backend.domain.patch.repository.PatchSuggestionRepository;
import io.secureai.backend.domain.user.entity.User;
import io.secureai.backend.domain.user.repository.UserRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.PageRequest;
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

    /**
     * AI Engine → Backend 내부 API용 — 패치 검증 결과를 기록한다 (TASK-1402).
     *
     * PatchSuggestion 도메인 메서드를 통해 상태를 전이한다 (직접 setter 금지).
     * VERIFIED / FAILED 만 수락한다 (PENDING은 초기 상태, 보고 대상이 아님).
     * 상태 전이는 모든 patchId에 대해 멱등하게 적용된다 (재시도 가능).
     *
     * @param patchId 패치 제안 UUID
     * @param request 검증 결과 ({status, log})
     */
    @Transactional
    public void reportVerification(UUID patchId, PatchVerificationRequest request) {
        PatchSuggestion patch = patchRepository.findById(patchId)
                .orElseThrow(() -> new BusinessException(ErrorCode.PATCH_NOT_FOUND));

        if (PatchSuggestion.VerificationStatus.VERIFIED.equals(request.status())) {
            patch.markVerified(null, request.log());
        } else {
            patch.markFailed(request.log());
        }

        log.info("[patch-verification] patchId={} status={}", patchId, request.status());
    }

    /**
     * AI Engine 내부 API용 — 이전 성공 패치 예시 조회 (최대 3건).
     * ADR-016: MCP PostgreSQL f-string SQL 대체. JPQL 파라미터 바인딩 사용.
     *
     * @param vulnType 취약점 유형 (SQL_INJECTION 등)
     * @param language 파일 확장자 없는 언어 식별자 (java, python, javascript 등)
     */
    @Transactional(readOnly = true)
    public List<PatchExampleItem> getPatchExamples(String vulnType, String language) {
        // LIKE 패턴: '%.java' 형태 — JPQL 파라미터 바인딩으로 조립하므로 안전
        String langSuffix = "%." + language;
        return patchRepository
                .findRecentByVulnTypeAndLangSuffix(vulnType, langSuffix, PageRequest.of(0, 3))
                .stream()
                .map(p -> new PatchExampleItem(
                        p.getOriginalSnippet(),
                        p.getPatchedSnippet(),
                        p.getExplanation()
                ))
                .toList();
    }
}
