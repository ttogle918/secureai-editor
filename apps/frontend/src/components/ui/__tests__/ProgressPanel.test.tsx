import { render, screen, fireEvent } from '@testing-library/react';
import { ProgressPanel } from '../ProgressPanel';
import type { ProgressStep } from '@/store/useSecureStore';

// ── Zustand 스토어 mock ──────────────────────────────────────────
jest.mock('@/store/useSecureStore', () => ({
  useSecureStore: (selector: (s: { progressSteps: ProgressStep[] }) => unknown) =>
    selector({ progressSteps: mockSteps }),
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
});
