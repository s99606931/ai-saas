// 공공데이터 연동 플러그인 캐시 유틸리티 테스트
// Design Ref: MTU-ECO3 Design 2.2
// Plan SC: FR-ECO3.7
// CSAP: D-11 시스템 보안 -- 캐시 무결성 검증

import { describe, it, expect, beforeEach } from 'vitest';
import { getCached, setCache, invalidateCache, getCacheStats } from '../../src/lib/cache';

// 테스트 격리를 위해 각 테스트 전에 캐시를 초기화
// 캐시 모듈 내부 Map을 직접 접근할 수 없으므로 고유 키를 사용
function uniqueKey(prefix: string): string {
  return `test:${prefix}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
}

describe('getCached / setCache (캐시 조회/저장)', () => {
  it('저장한 데이터를 조회할 수 있다', async () => {
    const key = uniqueKey('basic');
    const data = { name: '서울특별시', population: 9776000 };
    await setCache(key, data);
    const cached = await getCached(key);
    expect(cached).toEqual(data);
  });

  it('존재하지 않는 키에 대해 null을 반환한다', async () => {
    const result = await getCached(uniqueKey('nonexistent'));
    expect(result).toBeNull();
  });

  it('문자열 데이터를 캐싱한다', async () => {
    const key = uniqueKey('string');
    await setCache(key, '문자열 데이터');
    const cached = await getCached(key);
    expect(cached).toBe('문자열 데이터');
  });

  it('배열 데이터를 캐싱한다', async () => {
    const key = uniqueKey('array');
    const data = [1, 2, 3, '서울', '부산'];
    await setCache(key, data);
    const cached = await getCached(key);
    expect(cached).toEqual(data);
  });

  it('null 값을 캐싱한다', async () => {
    const key = uniqueKey('null');
    await setCache(key, null);
    // null은 falsy이므로 getCached의 !entry 체크에 걸리지 않고
    // entry.data가 null이 됨
    const cached = await getCached(key);
    // 주의: null이 저장되더라도 entry 자체는 존재하므로 null 반환이 맞음
    expect(cached).toBeNull();
  });

  it('중첩 객체를 캐싱한다', async () => {
    const key = uniqueKey('nested');
    const data = {
      dataset: {
        id: 'ds-001',
        items: [{ name: '인구통계' }],
      },
    };
    await setCache(key, data);
    const cached = await getCached(key);
    expect(cached).toEqual(data);
  });

  it('같은 키에 데이터를 덮어쓸 수 있다', async () => {
    const key = uniqueKey('overwrite');
    await setCache(key, 'original');
    await setCache(key, 'updated');
    const cached = await getCached(key);
    expect(cached).toBe('updated');
  });
});

describe('캐시 TTL (만료)', () => {
  it('커스텀 TTL을 설정할 수 있다 (유효 기간 내)', async () => {
    const key = uniqueKey('ttl-valid');
    await setCache(key, 'data', 3600); // 1시간
    const cached = await getCached(key);
    expect(cached).toBe('data');
  });

  // NOTE: TTL 만료 테스트는 실제 시간 경과가 필요하므로
  // 인메모리 캐시에서는 즉시 테스트가 어려움.
  // 단, 매우 짧은 TTL(0초)로 만료를 시뮬레이션할 수 있음.
  it('TTL이 0인 캐시는 즉시 만료된다', async () => {
    const key = uniqueKey('ttl-expired');
    await setCache(key, 'data', 0);
    // 약간의 지연 후 조회
    await new Promise((resolve) => setTimeout(resolve, 10));
    const cached = await getCached(key);
    expect(cached).toBeNull();
  });
});

describe('invalidateCache (캐시 무효화)', () => {
  it('특정 키의 캐시를 삭제한다', async () => {
    const key = uniqueKey('invalidate');
    await setCache(key, 'data');
    await invalidateCache(key);
    const cached = await getCached(key);
    expect(cached).toBeNull();
  });

  it('존재하지 않는 키를 무효화해도 에러가 발생하지 않는다', async () => {
    await expect(invalidateCache(uniqueKey('nonexistent'))).resolves.not.toThrow();
  });
});

describe('getCacheStats (캐시 통계)', () => {
  it('캐시 크기와 키 목록을 반환한다', async () => {
    const key = uniqueKey('stats');
    await setCache(key, 'data');
    const stats = getCacheStats();
    expect(typeof stats.size).toBe('number');
    expect(stats.size).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(stats.keys)).toBe(true);
    expect(stats.keys).toContain(key);
  });
});
