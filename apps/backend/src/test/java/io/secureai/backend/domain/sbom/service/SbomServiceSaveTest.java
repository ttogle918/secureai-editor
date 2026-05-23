package io.secureai.backend.domain.sbom.service;

import io.secureai.backend.domain.analysis.entity.AnalysisSession;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.domain.cve.repository.CveDataRepository;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.sbom.dto.SaveComponentsRequest;
import io.secureai.backend.domain.sbom.entity.DependencyComponent;
import io.secureai.backend.domain.sbom.parser.SbomParserFactory;
import io.secureai.backend.domain.sbom.repository.DependencyComponentRepository;
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

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SbomServiceSaveTest {

    @Mock SbomParserFactory parserFactory;
    @Mock DependencyComponentRepository componentRepository;
    @Mock AnalysisSessionRepository sessionRepository;
    @Mock ProjectRepository projectRepository;
    @Mock CveDataRepository cveDataRepository;

    @InjectMocks SbomService service;

    private UUID sessionId;
    private UUID projectId;
    private AnalysisSession session;
    private Project project;

    @BeforeEach
    void setUp() {
        sessionId = UUID.randomUUID();
        projectId = UUID.randomUUID();
        session   = mock(AnalysisSession.class);
        project   = mock(Project.class);

        // 세션·프로젝트 기본 stub — 일부 테스트(unknownSession 케이스)에서 사용 안 되므로 lenient() 적용
        lenient().when(sessionRepository.findById(sessionId)).thenReturn(Optional.of(session));
        lenient().when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
    }

    @Test
    @DisplayName("saveComponents — 컴포넌트 목록을 올바르게 저장한다")
    void saveComponents_saves_correct_number_of_components() {
        // given
        SaveComponentsRequest request = new SaveComponentsRequest(
                sessionId, projectId,
                List.of(
                        new SaveComponentsRequest.ComponentItem("log4j", "2.14.1", "maven", List.of()),
                        new SaveComponentsRequest.ComponentItem("lodash", "4.17.21", "npm", List.of())
                )
        );
        when(componentRepository.saveAll(anyList())).thenAnswer(inv -> inv.getArgument(0));

        // when
        int saved = service.saveComponents(request);

        // then
        assertThat(saved).isEqualTo(2);
        verify(componentRepository).saveAll(anyList());
    }

    @Test
    @DisplayName("saveComponents — groupId:artifactId 형태의 이름을 올바르게 분리한다")
    void saveComponents_splits_group_and_artifact_correctly() {
        // given
        SaveComponentsRequest request = new SaveComponentsRequest(
                sessionId, projectId,
                List.of(new SaveComponentsRequest.ComponentItem(
                        "org.springframework:spring-core", "5.3.10", "maven", List.of()
                ))
        );

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<DependencyComponent>> captor = ArgumentCaptor.forClass(List.class);
        when(componentRepository.saveAll(captor.capture())).thenAnswer(inv -> inv.getArgument(0));

        // when
        service.saveComponents(request);

        // then
        List<DependencyComponent> saved = captor.getValue();
        assertThat(saved).hasSize(1);
        assertThat(saved.get(0).getGroupId()).isEqualTo("org.springframework");
        assertThat(saved.get(0).getArtifactId()).isEqualTo("spring-core");
        assertThat(saved.get(0).getVersion()).isEqualTo("5.3.10");
    }

    @Test
    @DisplayName("saveComponents — 빈 컴포넌트 목록이면 0을 반환한다")
    void saveComponents_returns_zero_for_empty_list() {
        // given
        SaveComponentsRequest request = new SaveComponentsRequest(
                sessionId, projectId, List.of()
        );

        // when
        int saved = service.saveComponents(request);

        // then
        assertThat(saved).isZero();
        verifyNoInteractions(componentRepository);
    }

    @Test
    @DisplayName("saveComponents — 세션이 없으면 BusinessException 발생")
    void saveComponents_throws_when_session_not_found() {
        // given
        UUID unknownSession = UUID.randomUUID();
        when(sessionRepository.findById(unknownSession)).thenReturn(Optional.empty());

        SaveComponentsRequest request = new SaveComponentsRequest(
                unknownSession, projectId,
                List.of(new SaveComponentsRequest.ComponentItem("log4j", "2.14.1", "maven", List.of()))
        );

        // when / then
        assertThatThrownBy(() -> service.saveComponents(request))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.SESSION_NOT_FOUND);
    }
}
