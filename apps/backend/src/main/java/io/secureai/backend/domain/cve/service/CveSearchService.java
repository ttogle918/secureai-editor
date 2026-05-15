package io.secureai.backend.domain.cve.service;

import io.secureai.backend.domain.cve.dto.CveSearchResponse;
import io.secureai.backend.domain.cve.entity.CveData;
import io.secureai.backend.domain.cve.repository.CveDataRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Slf4j
@Service
@RequiredArgsConstructor
public class CveSearchService {

    private final CveDataRepository cveDataRepository;

    /**
     * 패키지 이름으로 CVE 목록을 조회한다.
     *
     * version 파라미터는 향후 버전 범위 매칭에 활용할 수 있도록 수신하지만,
     * 현재 NVD 데이터의 affected_products 컬럼이 정형화되어 있지 않으므로
     * 이름 기반 LIKE 검색만 수행한다.
     *
     * @param packageName 검색할 패키지 이름 (빈 문자열 불가)
     * @param version     버전 문자열 (미사용, 향후 확장용)
     * @return CVE 목록 (없으면 빈 목록)
     */
    @Transactional(readOnly = true)
    public List<CveSearchResponse> search(String packageName, String version) {
        log.debug("[cve-search] packageName={} version={}", packageName, version);

        List<CveData> cveList = cveDataRepository.findByPackageName(packageName);
        return cveList.stream()
                .map(this::toResponse)
                .toList();
    }

    private CveSearchResponse toResponse(CveData cve) {
        return new CveSearchResponse(
                cve.getCveId(),
                cve.getDescription(),
                cve.getCvssScore(),
                cve.getCvssVector(),
                cve.getSeverity()
        );
    }
}
