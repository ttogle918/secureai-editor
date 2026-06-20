// src/lib/__tests__/vulnStatus.test.ts
// normalizeVulnStatus / isVulnResolved 단위 테스트
import { normalizeVulnStatus, isVulnResolved, type VulnStatus } from '../mockData';

describe('normalizeVulnStatus', () => {
  it('서버 canonical 값 "open" 은 그대로 반환한다', () => {
    expect(normalizeVulnStatus('open')).toBe('open');
  });

  it('서버 canonical 값 "false_positive" 는 그대로 반환한다', () => {
    expect(normalizeVulnStatus('false_positive')).toBe('false_positive');
  });

  it('서버 canonical 값 "fixed" 는 그대로 반환한다', () => {
    expect(normalizeVulnStatus('fixed')).toBe('fixed');
  });

  it('mock 잔재 "patched" 는 "open" 으로 폴백한다', () => {
    expect(normalizeVulnStatus('patched')).toBe('open');
  });

  it('mock 잔재 "pending" 은 "open" 으로 폴백한다', () => {
    expect(normalizeVulnStatus('pending')).toBe('open');
  });

  it('mock 잔재 "exploited" 는 "open" 으로 폴백한다', () => {
    expect(normalizeVulnStatus('exploited')).toBe('open');
  });

  it('빈 문자열은 "open" 으로 폴백한다', () => {
    expect(normalizeVulnStatus('')).toBe('open');
  });

  it('null 은 "open" 으로 폴백한다', () => {
    expect(normalizeVulnStatus(null)).toBe('open');
  });

  it('undefined 는 "open" 으로 폴백한다', () => {
    expect(normalizeVulnStatus(undefined)).toBe('open');
  });

  it('알 수 없는 임의 문자열은 "open" 으로 폴백한다', () => {
    expect(normalizeVulnStatus('UNKNOWN_STATUS')).toBe('open');
  });

  it('반환값은 항상 VulnStatus 범위 내 값이다', () => {
    const VALID: VulnStatus[] = ['open', 'false_positive', 'fixed'];
    const testInputs = ['open', 'false_positive', 'fixed', 'patched', null, undefined, ''];
    for (const input of testInputs) {
      expect(VALID).toContain(normalizeVulnStatus(input as string | null | undefined));
    }
  });
});

describe('isVulnResolved', () => {
  it('"fixed" 는 해결됨(true)으로 판정한다', () => {
    expect(isVulnResolved('fixed')).toBe(true);
  });

  it('"open" 은 해결됨이 아님(false)', () => {
    expect(isVulnResolved('open')).toBe(false);
  });

  it('"false_positive" 는 해결됨이 아님(false)', () => {
    expect(isVulnResolved('false_positive')).toBe(false);
  });
});
