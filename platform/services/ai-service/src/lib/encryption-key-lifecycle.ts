// 암호화 키 수명주기 관리 -- FR-N305.1~FR-N305.6
// Design Ref: MTU-N305 DESIGN §1~§6
// Plan SC: SC-1 (회전자동화 100%), SC-2 (만료키 사용 0건), SC-3 (생성~배포 10초), SC-4 (감사 100%)
// CSAP: D-06 감사 로그, D-09 암호화

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** 키 알고리즘 */
export type KeyAlgorithm = 'AES-256' | 'AES-128' | 'RSA-2048' | 'RSA-4096' | 'ECDSA-P256';

/** 키 상태 */
export type KeyStatus = 'active' | 'pre_rotation' | 'rotating' | 'retired' | 'destroyed';

/** 키 용도 */
export type KeyPurpose = 'encryption' | 'signing' | 'authentication' | 'key_wrapping';

/** 암호화 키 */
export interface EncryptionKey {
  readonly keyId: string;
  readonly tenantId: string;
  readonly algorithm: KeyAlgorithm;
  readonly purpose: KeyPurpose;
  readonly status: KeyStatus;
  readonly version: number;
  readonly keyMaterial: string; // 해시화된 참조 (실제 키 아님)
  readonly createdAt: string;
  readonly expiresAt: string;
  readonly rotatedAt: string | null;
  readonly lastUsedAt: string | null;
  readonly usageCount: number;
}

/** 키 회전 스케줄 */
export interface RotationSchedule {
  readonly scheduleId: string;
  readonly tenantId: string;
  readonly keyId: string;
  readonly intervalDays: number;
  readonly nextRotationAt: string;
  readonly autoRotate: boolean;
  readonly notifyDaysBefore: number[];
}

/** 키 사용 이벤트 */
export interface KeyUsageEvent {
  readonly eventId: string;
  readonly keyId: string;
  readonly tenantId: string;
  readonly operation: 'encrypt' | 'decrypt' | 'sign' | 'verify';
  readonly service: string;
  readonly timestamp: string;
}

/** 키 만료 알림 */
export interface KeyExpiryAlert {
  readonly alertId: string;
  readonly keyId: string;
  readonly tenantId: string;
  readonly daysRemaining: number;
  readonly alertType: 'reminder' | 'urgent' | 'expired';
  readonly message: string;
  readonly createdAt: string;
}

/** 감사 로그 */
export interface KeyAuditEntry {
  readonly timestamp: string;
  readonly actor: string;
  readonly tenantId: string;
  readonly action: string;
  readonly target: string;
  readonly details: Record<string, unknown>;
}

// -- 감사 로그 ────────────────────────────────────────────────────────────────

const auditLog: KeyAuditEntry[] = [];

function recordAudit(entry: Omit<KeyAuditEntry, 'timestamp'>): void {
  auditLog.push({ ...entry, timestamp: new Date().toISOString() });
}

export function getKeyAuditLog(tenantId: string): readonly KeyAuditEntry[] {
  return auditLog.filter(e => e.tenantId === tenantId);
}

// -- 키 생성 ──────────────────────────────────────────────────────────────────

const keyStore: Map<string, EncryptionKey[]> = new Map();

/** 키 재료 해시 생성 (시뮬레이션: 실제 키 재료 저장 아님) */
function generateKeyReference(algorithm: KeyAlgorithm): string {
  const random = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
  return `ref:${algorithm}:${random.slice(0, 32)}`;
}

/** 암호화 키 생성 -- FR-N305.1 */
export function generateKey(
  tenantId: string,
  algorithm: KeyAlgorithm,
  purpose: KeyPurpose,
  expiryDays: number = 365,
): EncryptionKey {
  const now = new Date();
  const expiresAt = new Date(now);
  expiresAt.setDate(expiresAt.getDate() + expiryDays);

  const key: EncryptionKey = {
    keyId: `key-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    algorithm,
    purpose,
    status: 'active',
    version: 1,
    keyMaterial: generateKeyReference(algorithm),
    createdAt: now.toISOString(),
    expiresAt: expiresAt.toISOString(),
    rotatedAt: null,
    lastUsedAt: null,
    usageCount: 0,
  };

  const existing = keyStore.get(tenantId) ?? [];
  existing.push(key);
  keyStore.set(tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'KEY_GENERATED',
    target: key.keyId,
    details: { algorithm, purpose, expiryDays },
  });

  return key;
}

/** 키 목록 조회 */
export function getKeys(tenantId: string): readonly EncryptionKey[] {
  return keyStore.get(tenantId) ?? [];
}

// -- 키 회전 ──────────────────────────────────────────────────────────────────

const scheduleStore: Map<string, RotationSchedule[]> = new Map();

/** 키 회전 스케줄 설정 -- FR-N305.2 */
export function setRotationSchedule(
  tenantId: string,
  keyId: string,
  intervalDays: number = 90,
  autoRotate: boolean = true,
): RotationSchedule {
  const nextRotation = new Date();
  nextRotation.setDate(nextRotation.getDate() + intervalDays);

  const schedule: RotationSchedule = {
    scheduleId: `sched-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    tenantId,
    keyId,
    intervalDays,
    nextRotationAt: nextRotation.toISOString(),
    autoRotate,
    notifyDaysBefore: [30, 7, 1],
  };

  const existing = scheduleStore.get(tenantId) ?? [];
  existing.push(schedule);
  scheduleStore.set(tenantId, existing);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'ROTATION_SCHEDULED',
    target: keyId,
    details: { intervalDays, autoRotate },
  });

  return schedule;
}

/** 키 회전 실행 */
export function rotateKey(
  tenantId: string,
  keyId: string,
): EncryptionKey | null {
  const keys = keyStore.get(tenantId) ?? [];
  const currentKey = keys.find(k => k.keyId === keyId);
  if (!currentKey) return null;

  // 기존 키 retired 처리
  const updatedKeys = keys.map(k => {
    if (k.keyId === keyId) {
      return { ...k, status: 'retired' as const, rotatedAt: new Date().toISOString() };
    }
    return k;
  });
  keyStore.set(tenantId, updatedKeys);

  // 새 키 생성
  const newKey = generateKey(tenantId, currentKey.algorithm, currentKey.purpose);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'KEY_ROTATED',
    target: keyId,
    details: { oldKeyId: keyId, newKeyId: newKey.keyId },
  });

  return newKey;
}

// -- 키 사용 추적 ────────────────────────────────────────────────────────────

const usageStore: KeyUsageEvent[] = [];

/** 키 사용 추적 -- FR-N305.3 */
export function trackKeyUsage(
  tenantId: string,
  keyId: string,
  operation: KeyUsageEvent['operation'],
  service: string,
): KeyUsageEvent {
  const event: KeyUsageEvent = {
    eventId: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    keyId,
    tenantId,
    operation,
    service,
    timestamp: new Date().toISOString(),
  };

  usageStore.push(event);

  // 키 사용 카운트 업데이트
  const keys = keyStore.get(tenantId) ?? [];
  const updated = keys.map(k => {
    if (k.keyId === keyId) {
      return { ...k, lastUsedAt: event.timestamp, usageCount: k.usageCount + 1 };
    }
    return k;
  });
  keyStore.set(tenantId, updated);

  return event;
}

/** 키 사용 이력 조회 */
export function getKeyUsageHistory(tenantId: string, keyId: string): readonly KeyUsageEvent[] {
  return usageStore.filter(e => e.tenantId === tenantId && e.keyId === keyId);
}

// -- 키 만료 알림 ────────────────────────────────────────────────────────────

/** 키 만료 사전 알림 -- FR-N305.4 */
export function checkKeyExpiry(tenantId: string): KeyExpiryAlert[] {
  const keys = getKeys(tenantId);
  const now = Date.now();
  const alerts: KeyExpiryAlert[] = [];

  for (const key of keys) {
    if (key.status === 'destroyed' || key.status === 'retired') continue;

    const expiryTime = new Date(key.expiresAt).getTime();
    const daysRemaining = Math.floor((expiryTime - now) / (1000 * 60 * 60 * 24));

    if (daysRemaining <= 0) {
      alerts.push({
        alertId: `kalert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        keyId: key.keyId,
        tenantId,
        daysRemaining: 0,
        alertType: 'expired',
        message: `키 만료: ${key.keyId} (${key.algorithm}) - 즉시 회전 필요`,
        createdAt: new Date().toISOString(),
      });
    } else if (daysRemaining <= 7) {
      alerts.push({
        alertId: `kalert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        keyId: key.keyId,
        tenantId,
        daysRemaining,
        alertType: 'urgent',
        message: `키 만료 임박 (${daysRemaining}일): ${key.keyId} (${key.algorithm})`,
        createdAt: new Date().toISOString(),
      });
    } else if (daysRemaining <= 30) {
      alerts.push({
        alertId: `kalert-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        keyId: key.keyId,
        tenantId,
        daysRemaining,
        alertType: 'reminder',
        message: `키 만료 예정 (${daysRemaining}일): ${key.keyId} (${key.algorithm})`,
        createdAt: new Date().toISOString(),
      });
    }
  }

  return alerts;
}

// -- 키 폐기 ──────────────────────────────────────────────────────────────────

/** 키 안전 폐기 -- FR-N305.5 */
export function destroyKey(tenantId: string, keyId: string): boolean {
  const keys = keyStore.get(tenantId) ?? [];
  const idx = keys.findIndex(k => k.keyId === keyId);
  if (idx < 0) return false;

  // 제로화 (시뮬레이션: status 변경)
  const updated = keys.map(k => {
    if (k.keyId === keyId) {
      return { ...k, status: 'destroyed' as const, keyMaterial: 'ZEROED' };
    }
    return k;
  });
  keyStore.set(tenantId, updated);

  recordAudit({
    actor: 'system',
    tenantId,
    action: 'KEY_DESTROYED',
    target: keyId,
    details: { method: 'zeroization' },
  });

  return true;
}

/** 암호화 키 수명주기 서비스 */
export class EncryptionKeyLifecycleService {
  constructor(private readonly tenantId: string) {}

  generate(algorithm: KeyAlgorithm, purpose: KeyPurpose, expiryDays?: number): EncryptionKey {
    return generateKey(this.tenantId, algorithm, purpose, expiryDays);
  }

  getKeys(): readonly EncryptionKey[] {
    return getKeys(this.tenantId);
  }

  setRotation(keyId: string, intervalDays?: number): RotationSchedule {
    return setRotationSchedule(this.tenantId, keyId, intervalDays);
  }

  rotate(keyId: string): EncryptionKey | null {
    return rotateKey(this.tenantId, keyId);
  }

  trackUsage(keyId: string, op: KeyUsageEvent['operation'], service: string): KeyUsageEvent {
    return trackKeyUsage(this.tenantId, keyId, op, service);
  }

  checkExpiry(): KeyExpiryAlert[] {
    return checkKeyExpiry(this.tenantId);
  }

  destroy(keyId: string): boolean {
    return destroyKey(this.tenantId, keyId);
  }

  getAuditLog(): readonly KeyAuditEntry[] {
    return getKeyAuditLog(this.tenantId);
  }
}
