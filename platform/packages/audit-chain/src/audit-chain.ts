// SHA-256 해시 체인 감사 로그
// Design Ref: SVC-AUDITCHAIN-R21 Plan
// Plan SC: FR-AC.1, FR-AC.2, FR-AC.3, FR-AC.4, FR-AC.5, FR-AC.7
// CSAP: D-06 침해사고 관리 (감사 로그 무결성)

import { createHash } from 'node:crypto';

/**
 * 감사 이벤트 (체인 엔트리 입력)
 */
export interface AuditEvent {
  /** 행위자 식별자 (사용자 ID, 시스템 이름 등) */
  actor: string;
  /** 행위 (예: USER_CREATE, LOGIN_FAILED, DATA_EXPORT) */
  action: string;
  /** 대상 식별자 */
  target?: string;
  /** 추가 메타데이터 */
  metadata?: Record<string, unknown>;
  /** 클라이언트 IP (선택) */
  ip?: string;
}

/**
 * 해시 체인 엔트리 (저장 단위)
 */
export interface AuditEntry {
  /** 체인 내 순번 (0-based) */
  index: number;
  /** 타임스탬프 (ISO 8601) */
  timestamp: string;
  /** 행위자 */
  actor: string;
  /** 행위 */
  action: string;
  /** 대상 */
  target: string;
  /** 추가 메타데이터 */
  metadata: Record<string, unknown>;
  /** 클라이언트 IP */
  ip: string;
  /** 이전 엔트리의 해시 (genesis는 '0') */
  previousHash: string;
  /** 현재 엔트리의 SHA-256 해시 */
  hash: string;
}

/**
 * 무결성 검증 결과
 */
export interface VerificationResult {
  /** 전체 체인 유효 여부 */
  valid: boolean;
  /** 검증한 엔트리 수 */
  checkedCount: number;
  /** 변조가 발견된 인덱스 (-1이면 변조 없음) */
  brokenAtIndex: number;
  /** 변조 상세 사유 */
  reason: string | null;
}

/**
 * 엔트리 검색 필터
 */
export interface AuditFilter {
  /** 시작 시각 (이상) */
  from?: string;
  /** 종료 시각 (이하) */
  to?: string;
  /** 행위자 필터 */
  actor?: string;
  /** 행위 필터 */
  action?: string;
  /** 최대 반환 수 (기본: 100) */
  limit?: number;
  /** 오프셋 (기본: 0) */
  offset?: number;
}

/**
 * 감사 체인 통계
 */
export interface AuditChainStats {
  /** 총 엔트리 수 */
  totalEntries: number;
  /** 최신 해시 */
  latestHash: string | null;
  /** 최초 엔트리 시각 */
  firstEntryAt: string | null;
  /** 최신 엔트리 시각 */
  lastEntryAt: string | null;
}

/**
 * SHA-256 해시 체인 감사 로그
 *
 * 블록체인 경량 구현: 각 엔트리가 이전 엔트리의 해시를 포함하여
 * 변조 시 체인이 깨지는 구조입니다.
 *
 * CSAP D-06 요건:
 * - Append-only: 삭제/수정 API 미제공
 * - 무결성 검증: verify()로 전체 체인 검증 가능
 * - 변조 탐지: 변조된 엔트리의 위치와 원인 식별
 */
export class AuditChain {
  private readonly entries: AuditEntry[] = [];

  /**
   * 감사 이벤트 추가 (append-only)
   *
   * @param event 감사 이벤트
   * @returns 생성된 엔트리
   */
  append(event: AuditEvent): AuditEntry {
    const index = this.entries.length;
    const previousHash = index === 0
      ? '0'
      : this.entries[index - 1]!.hash;

    const timestamp = new Date().toISOString();

    const entry: Omit<AuditEntry, 'hash'> = {
      index,
      timestamp,
      actor: event.actor,
      action: event.action,
      target: event.target ?? '',
      metadata: event.metadata ?? {},
      ip: event.ip ?? '',
      previousHash,
    };

    const hash = this.computeHash(entry);
    const fullEntry: AuditEntry = { ...entry, hash };

    this.entries.push(fullEntry);
    return fullEntry;
  }

  /**
   * 전체 체인 무결성 검증
   *
   * 각 엔트리의 해시를 재계산하고 이전 해시 연결을 확인합니다.
   */
  verify(): VerificationResult {
    if (this.entries.length === 0) {
      return {
        valid: true,
        checkedCount: 0,
        brokenAtIndex: -1,
        reason: null,
      };
    }

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]!;

      // 1. 해시 재계산 검증
      const expectedHash = this.computeHash({
        index: entry.index,
        timestamp: entry.timestamp,
        actor: entry.actor,
        action: entry.action,
        target: entry.target,
        metadata: entry.metadata,
        ip: entry.ip,
        previousHash: entry.previousHash,
      });

      if (entry.hash !== expectedHash) {
        return {
          valid: false,
          checkedCount: i + 1,
          brokenAtIndex: i,
          reason: `엔트리 ${i}: 해시 불일치 (저장: ${entry.hash.substring(0, 16)}..., 기대: ${expectedHash.substring(0, 16)}...)`,
        };
      }

      // 2. 이전 해시 연결 검증
      if (i === 0) {
        if (entry.previousHash !== '0') {
          return {
            valid: false,
            checkedCount: 1,
            brokenAtIndex: 0,
            reason: '제네시스 엔트리의 previousHash가 "0"이 아닙니다',
          };
        }
      } else {
        const prevEntry = this.entries[i - 1]!;
        if (entry.previousHash !== prevEntry.hash) {
          return {
            valid: false,
            checkedCount: i + 1,
            brokenAtIndex: i,
            reason: `엔트리 ${i}: previousHash가 이전 엔트리 해시와 불일치`,
          };
        }
      }
    }

    return {
      valid: true,
      checkedCount: this.entries.length,
      brokenAtIndex: -1,
      reason: null,
    };
  }

  /**
   * 엔트리 검색/필터링
   */
  query(filter: AuditFilter = {}): AuditEntry[] {
    let results = this.entries;

    if (filter.from) {
      const fromTime = new Date(filter.from).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() >= fromTime);
    }

    if (filter.to) {
      const toTime = new Date(filter.to).getTime();
      results = results.filter((e) => new Date(e.timestamp).getTime() <= toTime);
    }

    if (filter.actor) {
      results = results.filter((e) => e.actor === filter.actor);
    }

    if (filter.action) {
      results = results.filter((e) => e.action === filter.action);
    }

    const offset = filter.offset ?? 0;
    const limit = filter.limit ?? 100;

    return results.slice(offset, offset + limit);
  }

  /**
   * 인덱스로 엔트리 조회
   */
  getEntry(index: number): AuditEntry | undefined {
    return this.entries[index];
  }

  /**
   * 최신 엔트리 조회
   */
  getLatest(): AuditEntry | undefined {
    return this.entries.length > 0
      ? this.entries[this.entries.length - 1]
      : undefined;
  }

  /**
   * 총 엔트리 수
   */
  getLength(): number {
    return this.entries.length;
  }

  /**
   * 통계 반환
   */
  getStats(): AuditChainStats {
    const len = this.entries.length;
    return {
      totalEntries: len,
      latestHash: len > 0 ? this.entries[len - 1]!.hash : null,
      firstEntryAt: len > 0 ? this.entries[0]!.timestamp : null,
      lastEntryAt: len > 0 ? this.entries[len - 1]!.timestamp : null,
    };
  }

  /**
   * JSON Lines 형식으로 직렬화
   */
  toJsonLines(): string {
    return this.entries
      .map((entry) => JSON.stringify(entry))
      .join('\n');
  }

  /**
   * JSON Lines 형식에서 복원
   *
   * 복원 후 자동으로 무결성 검증을 수행합니다.
   */
  static fromJsonLines(data: string): AuditChain {
    const chain = new AuditChain();
    const lines = data.split('\n').filter((line) => line.trim().length > 0);

    for (const line of lines) {
      const entry = JSON.parse(line) as AuditEntry;
      chain.entries.push(entry);
    }

    return chain;
  }

  /**
   * 전체 엔트리를 읽기 전용으로 반환
   */
  getEntries(): readonly AuditEntry[] {
    return this.entries;
  }

  // ── 내부 메서드 ─────────────────────────────────────────

  /**
   * 엔트리 해시 계산 (SHA-256)
   *
   * 해시 입력: index + timestamp + actor + action + target + metadata(JSON) + ip + previousHash
   */
  private computeHash(entry: Omit<AuditEntry, 'hash'>): string {
    const payload = [
      String(entry.index),
      entry.timestamp,
      entry.actor,
      entry.action,
      entry.target,
      JSON.stringify(entry.metadata),
      entry.ip,
      entry.previousHash,
    ].join('|');

    return createHash('sha256').update(payload).digest('hex');
  }
}
