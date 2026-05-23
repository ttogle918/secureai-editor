package io.secureai.backend.domain.sbom.service;

import io.secureai.backend.domain.cve.service.CveSearchService;
import io.secureai.backend.domain.project.entity.Project;
import io.secureai.backend.domain.project.repository.ProjectRepository;
import io.secureai.backend.domain.project.repository.TeamMemberRepository;
import io.secureai.backend.domain.sbom.dto.SbomComponentResponse;
import io.secureai.backend.domain.sbom.entity.DependencyComponent;
import io.secureai.backend.domain.sbom.parser.SbomParserFactory;
import io.secureai.backend.domain.sbom.repository.DependencyComponentRepository;
import io.secureai.backend.domain.analysis.repository.AnalysisSessionRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SbomServiceGetTest {

    @Mock SbomParserFactory parserFactory;
    @Mock DependencyComponentRepository componentRepository;
    @Mock AnalysisSessionRepository sessionRepository;
    @Mock ProjectRepository projectRepository;
    @Mock TeamMemberRepository teamMemberRepository;
    @Mock CveSearchService cveSearchService;

    @InjectMocks SbomService service;

    private UUID projectId;
    private UUID sessionId;
    private UUID userId;
    private Project project;

    @BeforeEach
    void setUp() {
        projectId = UUID.randomUUID();
        sessionId = UUID.randomUUID();
        userId    = UUID.randomUUID();
        project   = mock(Project.class);
    }

    @Test
    @DisplayName("getComponents — 팀 멤버이면 컴포넌트 목록을 반환한다")
    void getComponents_returnsComponentList() {
        // given
        DependencyComponent comp = DependencyComponent.builder()
                .packageManager("npm")
                .artifactId("lodash")
                .version("4.17.21")
                .isDirect(true)
                .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of(comp));

        // when
        List<SbomComponentResponse> result = service.getComponents(projectId, sessionId, userId);

        // then
        assertThat(result).hasSize(1);
        assertThat(result.get(0).name()).isEqualTo("lodash");
        assertThat(result.get(0).version()).isEqualTo("4.17.21");
        assertThat(result.get(0).ecosystem()).isEqualTo("npm");
        assertThat(result.get(0).isDirect()).isTrue();
    }

    @Test
    @DisplayName("getComponents — 팀 멤버가 아니면 PROJECT_ACCESS_DENIED 예외가 발생한다")
    void getComponents_projectNotOwned_throwsException() {
        // given
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(false);

        // when / then
        assertThatThrownBy(() -> service.getComponents(projectId, sessionId, userId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROJECT_ACCESS_DENIED);

        verifyNoInteractions(componentRepository);
    }

    @Test
    @DisplayName("getComponents — 해당 세션에 컴포넌트가 없으면 빈 리스트를 반환한다")
    void getComponents_sessionNotFound_returnsEmpty() {
        // given
        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of());

        // when
        List<SbomComponentResponse> result = service.getComponents(projectId, sessionId, userId);

        // then
        assertThat(result).isEmpty();
    }

    @Test
    @DisplayName("getComponents — 프로젝트가 없으면 PROJECT_NOT_FOUND 예외가 발생한다")
    void getComponents_projectNotFound_throwsException() {
        // given
        when(projectRepository.findById(projectId)).thenReturn(Optional.empty());

        // when / then
        assertThatThrownBy(() -> service.getComponents(projectId, sessionId, userId))
                .isInstanceOf(BusinessException.class)
                .extracting(e -> ((BusinessException) e).getErrorCode())
                .isEqualTo(ErrorCode.PROJECT_NOT_FOUND);

        verifyNoInteractions(componentRepository);
        verifyNoInteractions(teamMemberRepository);
    }

    @Test
    @DisplayName("getComponents — groupId:artifactId 형태의 이름을 올바르게 반환한다")
    void getComponents_groupArtifactName_isFormattedCorrectly() {
        // given
        DependencyComponent comp = DependencyComponent.builder()
                .packageManager("maven")
                .groupId("org.springframework")
                .artifactId("spring-core")
                .version("5.3.10")
                .isDirect(false)
                .build();

        when(projectRepository.findById(projectId)).thenReturn(Optional.of(project));
        when(teamMemberRepository.existsByProjectIdAndUserId(projectId, userId)).thenReturn(true);
        when(componentRepository.findBySession_Id(sessionId)).thenReturn(List.of(comp));

        // when
        List<SbomComponentResponse> result = service.getComponents(projectId, sessionId, userId);

        // then
        assertThat(result).hasSize(1);
        assertThat(result.get(0).name()).isEqualTo("org.springframework:spring-core");
        assertThat(result.get(0).isDirect()).isFalse();
    }
}
