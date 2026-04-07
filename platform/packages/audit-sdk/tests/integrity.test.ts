// 감사 로그 무결성 검증 테스트
// Design Ref: D-P00.4
// Plan SC: FR-P00.4
// CSAP: D-06 SHA-256 체인 무결성

import { describe, it, expect } from 'vitest';
import { computeHash, verifyChainIntegrity } from '../src/integrity.js';
import type { AuditEntry } from '@public-saas/types';

function makeEntry(overrides: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: 'entry-1',
    actor: 'user-1',
    action: 'TEST',
    target: 'resource-1',
    targetType: 'test',
    tenantId: 'tenant-1',
    timestamp: '2026-04-07T00:00:00.000Z',
    hash: '',
    previousHash: '0'.repeat(64),
    ip: '127.0.0.1',
    userAgent: 'test',
    ...overrides,
  };
}

describe('computeHash', () => {
  it('동일 입력에 대해 동일 해시를 반환한다', async () => {
    const entry = makeEntry();
    const hash1 = await computeHash(entry);
    const hash2 = await computeHash(entry);
    expect(hash1).toBe(hash2);
  });

  it('SHA-256 형식 (64자 hex)을 반환한다', async () => {
    const hash = await computeHash(makeEntry());
    expect(hash).toHaveLength(64);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('다른 입력에 대해 다른 해시를 반환한다', async () => {
    const hash1 = await computeHash(makeEntry({ action: 'ACTION_A' }));
    const hash2 = await computeHash(makeEntry({ action: 'ACTION_B' }));
    expect(hash1).not.toBe(hash2);
  });
});

describe('verifyChainIntegrity', () => {
  it('빈 배열에 대해 유효 결과를 반환한다', async () => {
    const result = await verifyChainIntegrity([]);
    expect(result.valid).toBe(true);
  });

  it('올바른 체인은 유효하다', async () => {
    const entry1 = makeEntry({ id: 'e1', previousHash: '0'.repeat(64) });
    entry1.hash = await computeHash(entry1);

    const entry2 = makeEntry({
      id: 'e2',
      action: 'SECOND',
      previousHash: entry1.hash,
      timestamp: '2026-04-07T00:01:00.000Z',
    });
    entry2.hash = await computeHash(entry2);

    const result = await verifyChainIntegrity([entry1, entry2]);
    expect(result.valid).toBe(true);
  });

  it('해시가 변조되면 무효 결과를 반환한다', async () => {
    const entry1 = makeEntry({ id: 'e1', previousHash: '0'.repeat(64) });
    entry1.hash = await computeHash(entry1);

    // 해시 변조
    const tampered = { ...entry1, hash: 'tampered_hash_value'.padEnd(64, '0') };

    const result = await verifyChainIntegrity([tampered]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(0);
  });

  it('체인 연결이 깨지면 무효 결과를 반환한다', async () => {
    const entry1 = makeEntry({ id: 'e1', previousHash: '0'.repeat(64) });
    entry1.hash = await computeHash(entry1);

    const entry2 = makeEntry({
      id: 'e2',
      action: 'SECOND',
      previousHash: 'wrong_previous_hash'.padEnd(64, '0'), // 잘못된 참조
      timestamp: '2026-04-07T00:01:00.000Z',
    });
    entry2.hash = await computeHash(entry2);

    const result = await verifyChainIntegrity([entry1, entry2]);
    expect(result.valid).toBe(false);
    expect(result.brokenAt).toBe(1);
  });
});
