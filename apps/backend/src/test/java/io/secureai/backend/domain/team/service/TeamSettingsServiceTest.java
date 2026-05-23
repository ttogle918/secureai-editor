package io.secureai.backend.domain.team.service;

import io.secureai.backend.domain.team.entity.TeamSettings;
import io.secureai.backend.domain.team.repository.TeamSettingsRepository;
import io.secureai.backend.global.exception.BusinessException;
import io.secureai.backend.global.exception.ErrorCode;
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
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class TeamSettingsServiceTest {

    @Mock
    private TeamSettingsRepository teamSettingsRepository;

    @InjectMocks
    private TeamSettingsService service;

    @Test
    @DisplayName("팀 설정이 없으면 새로 생성하여 저장한다")
    void updateIpAllowlist_noExistingSettings_createsNew() {
        UUID teamId = UUID.randomUUID();
        when(teamSettingsRepository.findByTeamId(teamId)).thenReturn(Optional.empty());
        when(teamSettingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.updateIpAllowlist(teamId, List.of("192.168.1.0/24"));

        ArgumentCaptor<TeamSettings> captor = ArgumentCaptor.forClass(TeamSettings.class);
        verify(teamSettingsRepository).save(captor.capture());
        assertThat(captor.getValue().getTeamId()).isEqualTo(teamId);
        assertThat(captor.getValue().getAllowedIpRanges()).containsExactly("192.168.1.0/24");
    }

    @Test
    @DisplayName("팀 설정이 이미 있으면 업데이트한다")
    void updateIpAllowlist_existingSettings_updates() {
        UUID teamId = UUID.randomUUID();
        TeamSettings existing = TeamSettings.builder()
                .teamId(teamId)
                .allowedIpRanges(List.of("10.0.0.0/8"))
                .build();
        when(teamSettingsRepository.findByTeamId(teamId)).thenReturn(Optional.of(existing));
        when(teamSettingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.updateIpAllowlist(teamId, List.of("172.16.0.0/12"));

        verify(teamSettingsRepository).save(existing);
        assertThat(existing.getAllowedIpRanges()).containsExactly("172.16.0.0/12");
    }

    @Test
    @DisplayName("빈 목록으로 업데이트하면 모든 IP가 허용된다")
    void updateIpAllowlist_emptyList_allowsAll() {
        UUID teamId = UUID.randomUUID();
        when(teamSettingsRepository.findByTeamId(teamId)).thenReturn(Optional.empty());
        when(teamSettingsRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        assertThatNoException().isThrownBy(() ->
                service.updateIpAllowlist(teamId, List.of()));
    }

    @Test
    @DisplayName("유효하지 않은 CIDR 형식이면 INVALID_CIDR_FORMAT 예외가 발생한다")
    void updateIpAllowlist_invalidCidr_throwsException() {
        UUID teamId = UUID.randomUUID();
        assertThatThrownBy(() -> service.updateIpAllowlist(teamId, List.of("NOT_VALID")))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_CIDR_FORMAT));
    }

    @Test
    @DisplayName("프리픽스 길이가 32를 초과하면 INVALID_CIDR_FORMAT 예외가 발생한다")
    void updateIpAllowlist_prefixTooLarge_throwsException() {
        UUID teamId = UUID.randomUUID();
        assertThatThrownBy(() -> service.updateIpAllowlist(teamId, List.of("192.168.1.0/33")))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_CIDR_FORMAT));
    }

    @Test
    @DisplayName("프리픽스 부분이 숫자가 아니면 INVALID_CIDR_FORMAT 예외가 발생한다")
    void updateIpAllowlist_nonNumericPrefix_throwsException() {
        UUID teamId = UUID.randomUUID();
        assertThatThrownBy(() -> service.updateIpAllowlist(teamId, List.of("192.168.1.0/abc")))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_CIDR_FORMAT));
    }

    @Test
    @DisplayName("슬래시가 없는 값이면 INVALID_CIDR_FORMAT 예외가 발생한다")
    void updateIpAllowlist_missingSlash_throwsException() {
        UUID teamId = UUID.randomUUID();
        assertThatThrownBy(() -> service.updateIpAllowlist(teamId, List.of("192.168.1.1")))
                .isInstanceOf(BusinessException.class)
                .satisfies(ex -> assertThat(((BusinessException) ex).getErrorCode())
                        .isEqualTo(ErrorCode.INVALID_CIDR_FORMAT));
    }
}
