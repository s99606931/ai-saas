// Design Ref: MTU-N455 §mydata-consent
// Plan SC: FR-MD.1 ~ FR-MD.5
// CSAP: D-06 (감사 로그 append-only), D-08 (접근 통제)
//
// 마이데이터 동의 수명주기 관리. 모든 상태 전이는 append-only 감사 로그에 기록.
// 외부 API 호출 없음 — 순수 로컬 상태 머신.

export type ConsentPurpose = string; // 예: 'account_linking', 'marketing', 'analytics'
export type ConsentStatus = 'pending' | 'granted' | 'revoked' | 'expired';
export type ConsentEventType = 'created' | 'granted' | 'modified' | 'revoked' | 'expired';

export interface ConsentScope {
  dataCategory: string; // 예: 'identity', 'financial', 'medical'
  fields: string[]; // 세부 항목
  required: boolean;
}

export interface Consent {
  id: string;
  subjectId: string; // 정보주체 ID
  purpose: ConsentPurpose;
  scopes: ConsentScope[];
  status: ConsentStatus;
  grantedAt?: string;
  expiresAt?: string;
  revokedAt?: string;
  version: number;
}

export interface ConsentEvent {
  id: string;
  consentId: string;
  type: ConsentEventType;
  at: string;
  actor: string;
  diff?: unknown;
  reason?: string;
}

export interface RightsRequest {
  type: 'access' | 'delete' | 'portability' | 'correction' | 'object';
  subjectId: string;
  routedTo: string;
  at: string;
}

// FR-MD.4: append-only 감사 로그 (수정/삭제 불가 구조)
export class ConsentAuditLog {
  private events: readonly ConsentEvent[] = [];
  private nextSeq = 1;

  append(event: Omit<ConsentEvent, 'id'>): ConsentEvent {
    const full: ConsentEvent = { id: `evt-${this.nextSeq++}`, ...event };
    // Object.freeze + 새 배열로 불변성 보장
    this.events = Object.freeze([...this.events, Object.freeze(full)]);
    return full;
  }

  listByConsent(consentId: string): ConsentEvent[] {
    return this.events.filter((e) => e.consentId === consentId).map((e) => ({ ...e }));
  }

  listBySubject(subjectId: string, consents: Map<string, Consent>): ConsentEvent[] {
    const ids = new Set(
      Array.from(consents.values())
        .filter((c) => c.subjectId === subjectId)
        .map((c) => c.id),
    );
    return this.events.filter((e) => ids.has(e.consentId)).map((e) => ({ ...e }));
  }

  size(): number {
    return this.events.length;
  }
}

// FR-MD.1, FR-MD.2, FR-MD.3: 동의 수명주기 관리
export class ConsentManager {
  private consents: Map<string, Consent> = new Map();
  private nextId = 1;

  constructor(private audit: ConsentAuditLog = new ConsentAuditLog()) {}

  // FR-MD.1: 동의 생성 (필수/선택 구분 scopes)
  create(params: {
    subjectId: string;
    purpose: ConsentPurpose;
    scopes: ConsentScope[];
    actor: string;
  }): Consent {
    const id = `csn-${this.nextId++}`;
    const now = new Date().toISOString();
    const consent: Consent = {
      id,
      subjectId: params.subjectId,
      purpose: params.purpose,
      scopes: params.scopes,
      status: 'pending',
      version: 1,
    };
    this.consents.set(id, consent);
    this.audit.append({
      consentId: id,
      type: 'created',
      at: now,
      actor: params.actor,
    });
    return { ...consent };
  }

  grant(consentId: string, actor: string, ttlMs?: number): Consent {
    const c = this.mustGet(consentId);
    if (c.status === 'revoked') {
      throw new Error(`Cannot grant revoked consent: ${consentId}`);
    }
    const now = new Date();
    c.status = 'granted';
    c.grantedAt = now.toISOString();
    if (ttlMs !== undefined) {
      c.expiresAt = new Date(now.getTime() + ttlMs).toISOString();
    }
    this.audit.append({
      consentId,
      type: 'granted',
      at: c.grantedAt,
      actor,
    });
    return { ...c };
  }

  // FR-MD.3: 동적 범위 제어 — 필수 항목 제거 금지
  modifyScopes(consentId: string, newScopes: ConsentScope[], actor: string): Consent {
    const c = this.mustGet(consentId);
    const requiredMissing = c.scopes
      .filter((s) => s.required)
      .filter((req) => !newScopes.some((ns) => ns.dataCategory === req.dataCategory));
    if (requiredMissing.length > 0) {
      throw new Error(
        `Cannot remove required scopes: ${requiredMissing.map((r) => r.dataCategory).join(',')}`,
      );
    }
    const prev = c.scopes;
    c.scopes = newScopes;
    c.version += 1;
    this.audit.append({
      consentId,
      type: 'modified',
      at: new Date().toISOString(),
      actor,
      diff: { before: prev, after: newScopes },
    });
    return { ...c };
  }

  // FR-MD.2: 철회 (10초 이내 반영 — 동기 처리이므로 즉시)
  revoke(consentId: string, actor: string, reason?: string): Consent {
    const c = this.mustGet(consentId);
    if (c.status === 'revoked') {
      return { ...c };
    }
    c.status = 'revoked';
    c.revokedAt = new Date().toISOString();
    this.audit.append({
      consentId,
      type: 'revoked',
      at: c.revokedAt,
      actor,
      reason,
    });
    return { ...c };
  }

  // 만료 일괄 처리
  expireOverdue(now: Date = new Date()): Consent[] {
    const expired: Consent[] = [];
    for (const c of this.consents.values()) {
      if (
        c.status === 'granted' &&
        c.expiresAt &&
        new Date(c.expiresAt) <= now
      ) {
        c.status = 'expired';
        this.audit.append({
          consentId: c.id,
          type: 'expired',
          at: now.toISOString(),
          actor: 'system',
        });
        expired.push({ ...c });
      }
    }
    return expired;
  }

  get(consentId: string): Consent | undefined {
    const c = this.consents.get(consentId);
    return c ? { ...c } : undefined;
  }

  listBySubject(subjectId: string): Consent[] {
    return Array.from(this.consents.values())
      .filter((c) => c.subjectId === subjectId)
      .map((c) => ({ ...c }));
  }

  // FR-MD.3: 현재 유효한 범위 질의 (granted + 만료되지 않음)
  effectiveScopes(consentId: string, now: Date = new Date()): ConsentScope[] {
    const c = this.consents.get(consentId);
    if (!c || c.status !== 'granted') return [];
    if (c.expiresAt && new Date(c.expiresAt) <= now) return [];
    return c.scopes.map((s) => ({ ...s, fields: [...s.fields] }));
  }

  auditLog(): ConsentAuditLog {
    return this.audit;
  }

  private mustGet(id: string): Consent {
    const c = this.consents.get(id);
    if (!c) throw new Error(`Consent not found: ${id}`);
    return c;
  }
}

// FR-MD.5: 정보주체 권리 요청 라우팅
export class RightsRouter {
  private routes: Record<RightsRequest['type'], string> = {
    access: 'dpo-team',
    delete: 'dpo-team',
    portability: 'data-export-team',
    correction: 'customer-service',
    object: 'dpo-team',
  };

  setRoute(type: RightsRequest['type'], destination: string): void {
    this.routes[type] = destination;
  }

  route(type: RightsRequest['type'], subjectId: string): RightsRequest {
    return {
      type,
      subjectId,
      routedTo: this.routes[type],
      at: new Date().toISOString(),
    };
  }
}
