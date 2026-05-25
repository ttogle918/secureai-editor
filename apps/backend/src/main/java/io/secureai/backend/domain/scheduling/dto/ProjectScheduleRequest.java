package io.secureai.backend.domain.scheduling.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;

/**
 * 프로젝트 스케줄 생성/수정 요청 DTO.
 *
 * <p>scanHour는 KST 기준 0~23 범위로 검증한다.
 * MVP에서는 실제 스캔 시각이 KST 01:00으로 고정되어 있으므로
 * scanHour는 사용자 의도를 기록하는 용도로만 사용된다.
 */
public record ProjectScheduleRequest(

        Boolean isActive,

        @Min(0)
        @Max(23)
        Integer scanHour
) {}
