import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ActiveDeviceSection } from '../ActiveDeviceSection';

// apiClient mock
jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
    delete: jest.fn(),
  },
}));

import { apiClient } from '@/lib/api/client';
const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

const mockSessions = [
  {
    id: 'session-1',
    deviceInfo: 'Chrome 120 on Windows',
    ip: '192.168.1.1',
    userAgent: 'Mozilla/5.0 Chrome/120',
    createdAt: '2026-06-01T10:00:00Z',
    expiresAt: '2026-06-01T11:00:00Z',
  },
  {
    id: 'session-2',
    deviceInfo: null,
    ip: null,
    userAgent: null,
    createdAt: '2026-06-02T10:00:00Z',
    expiresAt: '2026-06-02T11:00:00Z',
  },
];

describe('ActiveDeviceSection', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('로딩 중 메시지를 표시한다', () => {
    mockApiClient.get.mockReturnValue(new Promise(() => {}));
    render(<ActiveDeviceSection />);
    expect(screen.getByText('불러오는 중...')).toBeInTheDocument();
  });

  it('세션 목록을 렌더링한다', async () => {
    mockApiClient.get.mockResolvedValue({ data: mockSessions });
    render(<ActiveDeviceSection />);

    await waitFor(() => {
      expect(screen.getByText('Chrome 120 on Windows')).toBeInTheDocument();
    });
    expect(screen.getByText('IP: 192.168.1.1')).toBeInTheDocument();
  });

  it('세션 없을 때 빈 메시지를 표시한다', async () => {
    mockApiClient.get.mockResolvedValue({ data: [] });
    render(<ActiveDeviceSection />);

    await waitFor(() => {
      expect(screen.getByText('활성 세션이 없습니다.')).toBeInTheDocument();
    });
  });

  it('강제 로그아웃 버튼 클릭 시 DELETE 요청을 보낸다', async () => {
    mockApiClient.get.mockResolvedValue({ data: mockSessions });
    mockApiClient.delete.mockResolvedValue({});
    render(<ActiveDeviceSection />);

    await waitFor(() => {
      expect(screen.getAllByText('로그아웃')).toHaveLength(2);
    });

    fireEvent.click(screen.getAllByText('로그아웃')[0]);

    await waitFor(() => {
      expect(mockApiClient.delete).toHaveBeenCalledWith('/users/me/sessions/session-1');
    });
  });

  it('강제 로그아웃 후 해당 세션이 목록에서 제거된다', async () => {
    mockApiClient.get.mockResolvedValue({ data: mockSessions });
    mockApiClient.delete.mockResolvedValue({});
    render(<ActiveDeviceSection />);

    await waitFor(() => {
      expect(screen.getByText('Chrome 120 on Windows')).toBeInTheDocument();
    });

    fireEvent.click(screen.getAllByText('로그아웃')[0]);

    await waitFor(() => {
      expect(screen.queryByText('Chrome 120 on Windows')).not.toBeInTheDocument();
    });
  });

  it('알 수 없는 기기는 기본 레이블을 표시한다', async () => {
    mockApiClient.get.mockResolvedValue({ data: mockSessions });
    render(<ActiveDeviceSection />);

    await waitFor(() => {
      expect(screen.getByText('알 수 없는 기기')).toBeInTheDocument();
    });
  });
});
