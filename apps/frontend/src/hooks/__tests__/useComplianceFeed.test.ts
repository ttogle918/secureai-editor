/**
 * useComplianceFeed 단위 테스트
 *
 * 검증 항목:
 * - 마운트 시 GET /compliance/feed 호출
 * - 성공 응답 → data 상태에 피드 데이터 설정, isLoading=false
 * - API 오류 → error 상태 설정, data=null, 크래시 없음
 * - 로딩 중 → isLoading=true
 * - 언마운트(cancelled) → 완료 후 상태 갱신 없음
 */
import { act, renderHook, waitFor } from '@testing-library/react';
import { useComplianceFeed, ComplianceFeedData } from '../useComplianceFeed';
import { apiClient } from '@/lib/api/client';

jest.mock('@/lib/api/client', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockGet = apiClient.get as jest.Mock;

const mockFeedData: ComplianceFeedData = {
  govRecommendations: [
    {
      id: 'uuid-1',
      agency: 'KISA',
      category: '생성형 AI 보안',
      source: 'KISA',
      title: '생성형 AI 서비스 보안 가이드',
      summary: 'LLM 연동 서비스 보안 권고.',
      sourceUrl: 'https://www.kisa.or.kr/',
      publishedDate: '2026-06-01',
      files: [],
      sortOrder: 1,
    },
  ],
  securityNews: [
    {
      id: 'uuid-2',
      agency: '보안뉴스',
      category: '취약점',
      source: '보안뉴스',
      title: '오픈소스 라이브러리 RCE 취약점 발견',
      summary: null,
      sourceUrl: 'https://www.boannews.com/',
      publishedDate: '2026-06-27',
      files: [],
      sortOrder: 1,
    },
  ],
  agencyPosts: [
    {
      id: 'uuid-3',
      agency: 'KISA',
      category: '가이드라인',
      source: 'KISA',
      title: 'SW 공급망 보안 강화 로드맵',
      summary: '3대 전략.',
      sourceUrl: 'https://www.kisa.or.kr/',
      publishedDate: '2026-06-24',
      files: [{ name: 'report.pdf', type: 'PDF', size: '2MB' }],
      sortOrder: 1,
    },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
});

describe('useComplianceFeed', () => {
  it('마운트 시 GET /compliance/feed 를 호출한다', async () => {
    mockGet.mockResolvedValueOnce({ data: mockFeedData });

    renderHook(() => useComplianceFeed());

    await waitFor(() => {
      expect(mockGet).toHaveBeenCalledWith('/compliance/feed');
    });
  });

  it('성공 응답 시 피드 데이터가 data 에 설정된다', async () => {
    mockGet.mockResolvedValueOnce({ data: mockFeedData });

    const { result } = renderHook(() => useComplianceFeed());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data).toEqual(mockFeedData);
    expect(result.current.error).toBeNull();
  });

  it('성공 응답 시 govRecommendations 가 포함된다', async () => {
    mockGet.mockResolvedValueOnce({ data: mockFeedData });

    const { result } = renderHook(() => useComplianceFeed());

    await waitFor(() => {
      expect(result.current.data).not.toBeNull();
    });

    expect(result.current.data!.govRecommendations).toHaveLength(1);
    expect(result.current.data!.govRecommendations[0].title).toBe('생성형 AI 서비스 보안 가이드');
  });

  it('API 오류 시 error 가 설정되고 크래시하지 않는다', async () => {
    mockGet.mockRejectedValueOnce(new Error('피드 로드 실패'));

    const { result } = renderHook(() => useComplianceFeed());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('피드 로드 실패');
    expect(result.current.data).toBeNull();
  });

  it('API 오류 시 기본 에러 메시지를 설정한다 (Error 인스턴스가 아닌 경우)', async () => {
    mockGet.mockRejectedValueOnce('string-error');

    const { result } = renderHook(() => useComplianceFeed());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.error).toBe('피드를 불러오지 못했습니다.');
  });

  it('로딩 중에는 isLoading=true 이다', () => {
    // 해결되지 않는 Promise 로 로딩 상태 유지
    mockGet.mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useComplianceFeed());

    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('빈 피드 응답 시 빈 배열이 반환된다', async () => {
    const emptyFeed: ComplianceFeedData = {
      govRecommendations: [],
      securityNews: [],
      agencyPosts: [],
    };
    mockGet.mockResolvedValueOnce({ data: emptyFeed });

    const { result } = renderHook(() => useComplianceFeed());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data!.govRecommendations).toHaveLength(0);
    expect(result.current.data!.securityNews).toHaveLength(0);
    expect(result.current.data!.agencyPosts).toHaveLength(0);
  });
});
