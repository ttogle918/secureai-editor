package io.secureai.backend.domain.analysis.dto;

import jakarta.validation.constraints.Size;

import java.util.List;

/**
 * STAGE-2: 분석 계획 컨펌 요청 DTO.
 *
 * selectedStageNos: null = 전체 stage 포함, 리스트 = 선택된 stage만 포함
 * excludedFilePaths: AI Engine에서 체크포인트 files_to_scan 교집합만 허용(경로순회 방어)
 */
public record ConfirmPlanRequest(
        List<Integer> selectedStageNos,
        @Size(max = 500, message = "제외 파일 경로는 500개를 초과할 수 없습니다.")
        List<String> excludedFilePaths
) {
    /** 기본값 적용: null 필드를 빈 컬렉션으로 정규화하지 않음 — null 의미가 있음(selectedStageNos=null → 전체). */
    public List<String> effectiveExcludedFilePaths() {
        return excludedFilePaths != null ? excludedFilePaths : List.of();
    }
}
