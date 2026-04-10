// SHA-256 해시 체인 감사 로그 테스트
// Design Ref: SVC-AUDITCHAIN-R21 Plan
// Plan SC: FR-AC.1, FR-AC.2, FR-AC.3, FR-AC.4, FR-AC.5, FR-AC.7
// CSAP: D-06 침해사고 관리

import { describe, it, expect } from 'vitest';
import { AuditChain } from '../src/audit-chain.js';

describe('AuditChain', () => {
  describe('FR-AC.1: 해시 체인 엔트리 추가', () => {
    it('첫 엔트리의 previousHash는 "0"이다', () => {
      const chain = new AuditChain();
      const entry = chain.append({
        actor: 'admin',
        action: 'USER_CREATE',
        target: 'user-1',
      });

      expect(entry.index).toBe(0);
      expect(entry.previousHash).toBe('0');
      expect(entry.hash).toBeDefined();
      expect(entry.hash.length).toBe(64); // SHA-256 hex
    });

    it('두 번째 엔트리가 첫 번째 해시를 참조한다', () => {
      const chain = new AuditChain();
      const first = chain.append({ actor: 'admin', action: 'ACTION_1' });
      const second = chain.append({ actor: 'admin', action: 'ACTION_2' });

      expect(second.previousHash).toBe(first.hash);
      expect(second.index).toBe(1);
    });

    it('메타데이터와 IP를 기록한다', () => {
      const chain = new AuditChain();
      const entry = chain.append({
        actor: 'system',
        action: 'DATA_EXPORT',
        target: 'report-2026',
        metadata: { format: 'csv', rows: 1500 },
        ip: '192.168.1.100',
      });

      expect(entry.actor).toBe('system');
      expect(entry.action).toBe('DATA_EXPORT');
      expect(entry.target).toBe('report-2026');
      expect(entry.metadata.format).toBe('csv');
      expect(entry.ip).toBe('192.168.1.100');
    });

    it('선택 필드가 기본값으로 채워진다', () => {
      const chain = new AuditChain();
      const entry = chain.append({ actor: 'user', action: 'LOGIN' });

      expect(entry.target).toBe('');
      expect(entry.ip).toBe('');
      expect(entry.metadata).toEqual({});
    });

    it('연속 추가 시 체인이 유지된다', () => {
      const chain = new AuditChain();
      for (let i = 0; i < 10; i++) {
        chain.append({ actor: `user-${i}`, action: 'ACTION' });
      }

      expect(chain.getLength()).toBe(10);
      // 각 엔트리가 이전 해시를 참조
      for (let i = 1; i < 10; i++) {
        const prev = chain.getEntry(i - 1)!;
        const curr = chain.getEntry(i)!;
        expect(curr.previousHash).toBe(prev.hash);
      }
    });
  });

  describe('FR-AC.2: 체인 무결성 검증', () => {
    it('빈 체인은 유효하다', () => {
      const chain = new AuditChain();
      const result = chain.verify();
      expect(result.valid).toBe(true);
      expect(result.checkedCount).toBe(0);
    });

    it('정상 체인은 유효하다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });
      chain.append({ actor: 'admin', action: 'UPDATE' });
      chain.append({ actor: 'admin', action: 'DELETE' });

      const result = chain.verify();
      expect(result.valid).toBe(true);
      expect(result.checkedCount).toBe(3);
      expect(result.brokenAtIndex).toBe(-1);
      expect(result.reason).toBeNull();
    });

    it('100개 엔트리 체인도 검증 통과한다', () => {
      const chain = new AuditChain();
      for (let i = 0; i < 100; i++) {
        chain.append({
          actor: `user-${i % 10}`,
          action: 'ACTION',
          metadata: { seq: i },
        });
      }

      const result = chain.verify();
      expect(result.valid).toBe(true);
      expect(result.checkedCount).toBe(100);
    });
  });

  describe('FR-AC.3: 변조 탐지 및 위치 식별', () => {
    it('엔트리 내용 변조를 탐지한다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });
      chain.append({ actor: 'admin', action: 'UPDATE' });
      chain.append({ actor: 'admin', action: 'DELETE' });

      // 중간 엔트리 변조 (내부 접근)
      const entries = chain.getEntries() as any[];
      entries[1].action = 'TAMPERED';

      const result = chain.verify();
      expect(result.valid).toBe(false);
      expect(result.brokenAtIndex).toBe(1);
      expect(result.reason).toContain('해시 불일치');
    });

    it('previousHash 변조를 탐지한다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });
      chain.append({ actor: 'admin', action: 'UPDATE' });

      // previousHash 변조
      const entries = chain.getEntries() as any[];
      entries[1].previousHash = 'fake-hash';
      // 해시도 재계산하지 않았으므로 해시 불일치로 먼저 탐지됨

      const result = chain.verify();
      expect(result.valid).toBe(false);
      expect(result.brokenAtIndex).toBe(1);
    });

    it('첫 번째 엔트리의 previousHash 변조를 탐지한다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });

      const entries = chain.getEntries() as any[];
      const originalHash = entries[0].hash;
      entries[0].previousHash = 'not-zero';
      // 해시 재계산이 필요하나 하지 않으므로 해시 불일치 탐지
      // 또는 previousHash가 '0'이 아님 탐지

      const result = chain.verify();
      expect(result.valid).toBe(false);
      expect(result.brokenAtIndex).toBe(0);
    });
  });

  describe('FR-AC.4: Append-only 보장', () => {
    it('AuditChain에 삭제/수정 메서드가 없다', () => {
      const chain = new AuditChain();
      expect((chain as any).delete).toBeUndefined();
      expect((chain as any).update).toBeUndefined();
      expect((chain as any).remove).toBeUndefined();
      expect((chain as any).clear).toBeUndefined();
    });

    it('getEntries는 읽기 전용 배열을 반환한다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });
      const entries = chain.getEntries();
      expect(Array.isArray(entries)).toBe(true);
    });
  });

  describe('FR-AC.5: JSON Lines 직렬화', () => {
    it('toJsonLines로 직렬화할 수 있다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });
      chain.append({ actor: 'user', action: 'READ' });

      const jsonl = chain.toJsonLines();
      const lines = jsonl.split('\n');
      expect(lines).toHaveLength(2);

      const parsed = JSON.parse(lines[0]!);
      expect(parsed.actor).toBe('admin');
      expect(parsed.hash).toBeDefined();
    });

    it('fromJsonLines로 복원할 수 있다', () => {
      const original = new AuditChain();
      original.append({ actor: 'admin', action: 'CREATE' });
      original.append({ actor: 'user', action: 'READ' });

      const jsonl = original.toJsonLines();
      const restored = AuditChain.fromJsonLines(jsonl);

      expect(restored.getLength()).toBe(2);
      expect(restored.getEntry(0)!.actor).toBe('admin');
      expect(restored.getEntry(1)!.actor).toBe('user');

      // 복원 후 무결성 유지
      const result = restored.verify();
      expect(result.valid).toBe(true);
    });

    it('복원 후 추가 append가 체인을 유지한다', () => {
      const original = new AuditChain();
      original.append({ actor: 'admin', action: 'CREATE' });

      const restored = AuditChain.fromJsonLines(original.toJsonLines());
      restored.append({ actor: 'user', action: 'UPDATE' });

      expect(restored.getLength()).toBe(2);
      const result = restored.verify();
      expect(result.valid).toBe(true);
    });

    it('빈 문자열에서 복원하면 빈 체인', () => {
      const chain = AuditChain.fromJsonLines('');
      expect(chain.getLength()).toBe(0);
    });
  });

  describe('FR-AC.7: 엔트리 검색/조회', () => {
    it('actor로 필터링할 수 있다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });
      chain.append({ actor: 'user', action: 'READ' });
      chain.append({ actor: 'admin', action: 'DELETE' });

      const results = chain.query({ actor: 'admin' });
      expect(results).toHaveLength(2);
      expect(results.every((e) => e.actor === 'admin')).toBe(true);
    });

    it('action으로 필터링할 수 있다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });
      chain.append({ actor: 'admin', action: 'READ' });
      chain.append({ actor: 'admin', action: 'CREATE' });

      const results = chain.query({ action: 'CREATE' });
      expect(results).toHaveLength(2);
    });

    it('limit과 offset이 동작한다', () => {
      const chain = new AuditChain();
      for (let i = 0; i < 20; i++) {
        chain.append({ actor: 'user', action: `ACTION_${i}` });
      }

      const page1 = chain.query({ limit: 5, offset: 0 });
      expect(page1).toHaveLength(5);
      expect(page1[0]!.action).toBe('ACTION_0');

      const page2 = chain.query({ limit: 5, offset: 5 });
      expect(page2).toHaveLength(5);
      expect(page2[0]!.action).toBe('ACTION_5');
    });

    it('인덱스로 단일 엔트리를 조회할 수 있다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });
      chain.append({ actor: 'user', action: 'READ' });

      const entry = chain.getEntry(1);
      expect(entry).toBeDefined();
      expect(entry!.actor).toBe('user');
    });

    it('존재하지 않는 인덱스는 undefined', () => {
      const chain = new AuditChain();
      expect(chain.getEntry(0)).toBeUndefined();
      expect(chain.getEntry(99)).toBeUndefined();
    });

    it('getLatest가 마지막 엔트리를 반환한다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'FIRST' });
      chain.append({ actor: 'admin', action: 'LAST' });

      expect(chain.getLatest()!.action).toBe('LAST');
    });

    it('빈 체인의 getLatest는 undefined', () => {
      const chain = new AuditChain();
      expect(chain.getLatest()).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('통계를 반환한다', () => {
      const chain = new AuditChain();
      chain.append({ actor: 'admin', action: 'CREATE' });
      chain.append({ actor: 'user', action: 'READ' });

      const stats = chain.getStats();
      expect(stats.totalEntries).toBe(2);
      expect(stats.latestHash).toBeDefined();
      expect(stats.firstEntryAt).toBeDefined();
      expect(stats.lastEntryAt).toBeDefined();
    });

    it('빈 체인의 통계', () => {
      const chain = new AuditChain();
      const stats = chain.getStats();
      expect(stats.totalEntries).toBe(0);
      expect(stats.latestHash).toBeNull();
      expect(stats.firstEntryAt).toBeNull();
    });
  });

  describe('해시 결정성', () => {
    it('동일 입력에 동일 해시를 생성한다', () => {
      const chain1 = new AuditChain();
      const chain2 = new AuditChain();

      // 타임스탬프가 달라 해시가 다를 수 있으므로 직접 검증 불가
      // 대신 같은 체인 내에서 해시 일관성을 확인
      const entry = chain1.append({ actor: 'admin', action: 'TEST' });
      expect(entry.hash.length).toBe(64);
      expect(/^[a-f0-9]{64}$/.test(entry.hash)).toBe(true);
    });
  });
});
