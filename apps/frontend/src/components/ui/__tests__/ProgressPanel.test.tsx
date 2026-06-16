import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressPanel } from '../ProgressPanel';
import type { ProgressStep, StageInfo, StageVulns } from '@/store/useSecureStore';

// ── Zustand 스토어 mock ──────────────────────────────────────────
type MockStore = {
  progressSteps: ProgressStep[];
  stageList: StageInfo[];
  currentStageNo: number | null;
  scanningFile: null;
  apiGroups: [];
  fileStatuses: Record<string, never>;
  stageVulns: Record<number, StageVulns>;
  openTab: jest.Mock;
};

const mockStore: MockStore = {
  progressSteps: [],
  stageList: [],
  currentStageNo: null,
  scanningFile: null,
  apiGroups: [],
  fileStatuses: {},
  stageVulns: {},
  openTab: jest.fn(),
};

jest.mock('@/store/useSecureStore', () => ({
  useSecureStore: (selector: (s: MockStore) => unknown) =>
    selector({ ...mockStore, progressSteps: mockSteps }),
}));

const mockSteps: ProgressStep[] = [
  { stepName: 'SAST 초기화', stepOrder: 1, target: 'UserAuth.java',    status: 'completed', durationMs: 840 },
  { stepName: 'SAST 분석',   stepOrder: 2, target: 'AuthService.java', status: 'completed', durationMs: 1200 },
  { stepName: 'SAST 분석',   stepOrder: 3, target: 'LoginPage.tsx',    status: 'running',   durationMs: undefined },
  { stepName: 'DAST 준비',   stepOrder: 4, target: '전체',              status: 'pending',   durationMs: undefined },
];

// URL.createObjectURL / revokeObjectURL는 jsdom에 없어서 stub 처리
beforeAll(() => {
  global.URL.createObjectURL = jest.fn(() => 'blob:mock');
  global.URL.revokeObjectURL = jest.fn();
});

describe('ProgressPanel', () => {
  it('진행률 바가 50%로 렌더링된다 (2/4 완료)', () => {
    render(<ProgressPanel />);

    const bar = screen.getByRole('progressbar');
    expect(bar).toHaveAttribute('aria-valuenow', '50');
    expect(bar).toHaveAttribute('aria-valuemin', '0');
    expect(bar).toHaveAttribute('aria-valuemax', '100');
    expect(screen.getByText('2 / 4 완료 (50%)')).toBeInTheDocument();
  });

  it('모든 단계가 목록에 표시된다', () => {
    render(<ProgressPanel />);

    expect(screen.getByText('SAST 초기화')).toBeInTheDocument();
    expect(screen.getByText('AuthService.java')).toBeInTheDocument();
    expect(screen.getByText('LoginPage.tsx')).toBeInTheDocument();
    expect(screen.getByText('전체')).toBeInTheDocument();
  });

  it('완료 단계에 durationMs가 표시된다', () => {
    render(<ProgressPanel />);

    expect(screen.getByText('840ms')).toBeInTheDocument();
    expect(screen.getByText('1200ms')).toBeInTheDocument();
  });

  it('status별 aria-label이 올바르게 설정된다', () => {
    render(<ProgressPanel />);

    expect(screen.getAllByLabelText('완료')).toHaveLength(2);
    expect(screen.getAllByLabelText('진행 중')).toHaveLength(1);
    expect(screen.getAllByLabelText('대기')).toHaveLength(1);
  });

  it('다운로드 버튼 클릭 시 anchor click이 발생한다', () => {
    render(<ProgressPanel />);

    const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    const downloadBtn = screen.getByRole('button', { name: /체크리스트 다운로드/i });
    fireEvent.click(downloadBtn);

    expect(global.URL.createObjectURL).toHaveBeenCalled();
    expect(clickSpy).toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  // ── STAGE-1: stage 취약점 배지 ──────────────────────────────

  it('stage 완료 시 stageVulns가 있으면 "발견 N건" 배지가 표시된다', () => {
    // stageList와 stageVulns를 가진 스토어 설정
    mockStore.stageList = [
      { stage_no: 1, name: 'Auth Stage', file_count: 2, status: 'completed' },
    ];
    mockStore.stageVulns = {
      1: {
        stage_no: 1,
        vulns: [
          { id: 'v1', filePath: 'src/A.java', lineNumber: 10, vulnType: 'SQL_INJECTION', severity: 'HIGH' },
          { id: 'v2', filePath: 'src/B.java', lineNumber: 22, vulnType: 'XSS', severity: 'MEDIUM' },
        ],
        loaded: true,
      },
    };

    render(<ProgressPanel />);

    expect(screen.getByLabelText('Stage 1 취약점 2건')).toBeInTheDocument();
    expect(screen.getByText('발견 2건')).toBeInTheDocument();

    // cleanup
    mockStore.stageList = [];
    mockStore.stageVulns = {};
  });

  it('stage 취약점이 0건이면 "발견 0건" 배지가 표시된다', () => {
    mockStore.stageList = [
      { stage_no: 1, name: 'Clean Stage', file_count: 1, status: 'completed' },
    ];
    mockStore.stageVulns = {
      1: { stage_no: 1, vulns: [], loaded: true },
    };

    render(<ProgressPanel />);

    expect(screen.getByText('발견 0건')).toBeInTheDocument();

    mockStore.stageList = [];
    mockStore.stageVulns = {};
  });

  it('배지 클릭 시 취약점 펼침 목록이 표시된다', () => {
    mockStore.stageList = [
      { stage_no: 1, name: 'Auth Stage', file_count: 1, status: 'completed' },
    ];
    mockStore.stageVulns = {
      1: {
        stage_no: 1,
        vulns: [
          { id: 'v1', filePath: 'src/UserController.java', lineNumber: 5, vulnType: 'SQL_INJECTION', severity: 'HIGH' },
        ],
        loaded: true,
      },
    };

    render(<ProgressPanel />);

    const badge = screen.getByLabelText('Stage 1 취약점 1건');
    fireEvent.click(badge);

    // 파일명이 펼침 목록에 표시됨
    expect(screen.getByText('UserController.java')).toBeInTheDocument();

    mockStore.stageList = [];
    mockStore.stageVulns = {};
  });
});
