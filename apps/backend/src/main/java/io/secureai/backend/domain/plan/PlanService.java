package io.secureai.backend.domain.plan;

import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class PlanService {

    private final PlanRepository planRepository;

    @Transactional(readOnly = true)
    public Plan findByName(String name) {
        return planRepository.findByName(name)
                .orElseThrow(() -> new BusinessException(ErrorCode.ADMIN_PLAN_NOT_FOUND,
                        "기본 플랜을 찾을 수 없습니다: " + name));
    }
}
