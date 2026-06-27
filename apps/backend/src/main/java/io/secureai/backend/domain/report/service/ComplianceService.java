package io.secureai.backend.domain.report.service;

import io.secureai.backend.domain.report.entity.ComplianceFramework;
import io.secureai.backend.domain.report.entity.DocType;
import io.secureai.backend.domain.report.repository.ComplianceFrameworkRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ComplianceService {

    private final ComplianceFrameworkRepository frameworkRepository;

    @Transactional(readOnly = true)
    public List<ComplianceFramework> getActiveFrameworks(DocType docType) {
        return frameworkRepository.findByDocTypeAndStatusOrderByCreatedAtDesc(docType, "ACTIVE");
    }
}
