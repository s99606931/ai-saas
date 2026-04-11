// 시크릿 관리자
// Design Ref: SVC-SECRETMGR-R24 Plan
// Plan SC: FR-SM.1, FR-SM.2, FR-SM.3, FR-SM.4, FR-SM.5
// CSAP: D-09 암호화, D-08 접근 통제

import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * 시크릿 엔트리 (내부)
 */
interface SecretEntry {
  /** 암호화된 값 (hex) */
  encrypted: string;
  /** 초기화 벡터 (hex) */
  iv: string;
  /** 인증 태그 (hex) */
  authTag: string;
  /** 만료 시각 (밀리초 타임스탬프, 0 = 만료 없음) */
  expiresAt: number;
  /** 생성 시각 */
  createdAt: string;
  /** 갱신 시각 */
  updatedAt: string;
}

/**
 * 감사 로그 항목
 */
export interface SecretAuditEntry {
  /** 행위 */
  action: 'get' | 'set' | 'delete' | 'expired';
  /** 시크릿 이름 */
  name: string;
  /** 결과 */
  success: boolean;
  /** 타임스탬프 */
  timestamp: string;
  /** 소스 (store / env) */
  source?: string;
}

/**
 * 시크릿 관리자 옵션
 */
export interface SecretManagerOptions {
  /** 마스터 키 (암호화에 사용, 32바이트 권장) */
  masterKey: string;
  /** 환경 변수 폴백 활성화 (기본: true) */
  enableEnvFallback?: boolean;
  /** 감사 로그 최대 보존 수 (기본: 1000) */
  maxAuditEntries?: number;
  /** 만료 체크 주기 (밀리초, 기본: 60000, 0=비활성) */
  expirationCheckIntervalMs?: number;
}

/**
 * 시크릿 관리자 통계
 */
export interface SecretManagerStats {
  /** 저장된 시크릿 수 */
  secretCount: number;
  /** 감사 로그 수 */
  auditLogCount: number;
  /** 환경 변수 폴백 활성화 여부 */
  envFallbackEnabled: boolean;
}

/**
 * 시크릿 관리자
 *
 * AES-256-GCM으로 시크릿을 암호화하여 메모리에 저장합니다.
 * 저장소에 없는 시크릿은 환경 변수에서 폴백으로 조회합니다.
 *
 * CSAP D-09 요건:
 * - AES-256-GCM (NIST SP 800-38D)
 * - 모든 시크릿 접근 감사 로깅
 * - 시크릿 만료(TTL) 지원
 */
export class SecretManager {
  private readonly secrets = new Map<string, SecretEntry>();
  private readonly auditLog: SecretAuditEntry[] = [];
  private readonly derivedKey: Buffer;
  private readonly enableEnvFallback: boolean;
  private readonly maxAuditEntries: number;
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  constructor(options: SecretManagerOptions) {
    // scrypt로 키 파생 (32바이트 = 256비트)
    this.derivedKey = scryptSync(options.masterKey, 'public-saas-salt', 32);
    this.enableEnvFallback = options.enableEnvFallback !== false;
    this.maxAuditEntries = options.maxAuditEntries ?? 1000;

    const checkInterval = options.expirationCheckIntervalMs ?? 60_000;
    if (checkInterval > 0) {
      this.cleanupInterval = setInterval(() => this.removeExpired(), checkInterval);
    }
  }

  /**
   * 시크릿 저장 (암호화)
   *
   * @param name 시크릿 이름
   * @param value 평문 값
   * @param ttlMs TTL (밀리초, 0 = 만료 없음)
   */
  set(name: string, value: string, ttlMs: number = 0): void {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.derivedKey, iv);

    let encrypted = cipher.update(value, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    const authTag = cipher.getAuthTag().toString('hex');

    const now = new Date().toISOString();
    this.secrets.set(name, {
      encrypted,
      iv: iv.toString('hex'),
      authTag,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
      createdAt: this.secrets.has(name) ? this.secrets.get(name)!.createdAt : now,
      updatedAt: now,
    });

    this.addAudit({ action: 'set', name, success: true, timestamp: now });
  }

  /**
   * 시크릿 조회 (복호화)
   *
   * 1. 저장소에서 조회 (만료 확인)
   * 2. 없으면 환경 변수 폴백
   * 3. 둘 다 없으면 undefined
   */
  get(name: string): string | undefined {
    const now = new Date().toISOString();

    // 1. 저장소 조회
    const entry = this.secrets.get(name);
    if (entry) {
      // 만료 확인
      if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
        this.secrets.delete(name);
        this.addAudit({ action: 'expired', name, success: true, timestamp: now });
        // 폴백으로 계속
      } else {
        // 복호화
        try {
          const value = this.decrypt(entry);
          this.addAudit({ action: 'get', name, success: true, timestamp: now, source: 'store' });
          return value;
        } catch {
          this.addAudit({ action: 'get', name, success: false, timestamp: now, source: 'store' });
          return undefined;
        }
      }
    }

    // 2. 환경 변수 폴백
    if (this.enableEnvFallback) {
      const envValue = process.env[name];
      if (envValue !== undefined) {
        this.addAudit({ action: 'get', name, success: true, timestamp: now, source: 'env' });
        return envValue;
      }
    }

    this.addAudit({ action: 'get', name, success: false, timestamp: now });
    return undefined;
  }

  /**
   * 시크릿 존재 확인 (만료 미포함)
   */
  has(name: string): boolean {
    const entry = this.secrets.get(name);
    if (!entry) return false;
    if (entry.expiresAt > 0 && Date.now() >= entry.expiresAt) {
      this.secrets.delete(name);
      return false;
    }
    return true;
  }

  /**
   * 시크릿 삭제
   */
  delete(name: string): boolean {
    const existed = this.secrets.delete(name);
    this.addAudit({
      action: 'delete',
      name,
      success: existed,
      timestamp: new Date().toISOString(),
    });
    return existed;
  }

  /**
   * 시크릿 이름 목록 (값은 노출하지 않음)
   */
  listNames(): string[] {
    this.removeExpired();
    return Array.from(this.secrets.keys());
  }

  /**
   * 감사 로그 조회
   */
  getAuditLog(): readonly SecretAuditEntry[] {
    return this.auditLog;
  }

  /**
   * 통계
   */
  getStats(): SecretManagerStats {
    return {
      secretCount: this.secrets.size,
      auditLogCount: this.auditLog.length,
      envFallbackEnabled: this.enableEnvFallback,
    };
  }

  /**
   * 리소스 정리
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    this.secrets.clear();
  }

  // ── 내부 메서드 ─────────────────────────────────────────

  private decrypt(entry: SecretEntry): string {
    const decipher = createDecipheriv(
      'aes-256-gcm',
      this.derivedKey,
      Buffer.from(entry.iv, 'hex'),
    );
    decipher.setAuthTag(Buffer.from(entry.authTag, 'hex'));

    let decrypted = decipher.update(entry.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private removeExpired(): void {
    const now = Date.now();
    for (const [name, entry] of this.secrets) {
      if (entry.expiresAt > 0 && now >= entry.expiresAt) {
        this.secrets.delete(name);
        this.addAudit({
          action: 'expired',
          name,
          success: true,
          timestamp: new Date().toISOString(),
        });
      }
    }
  }

  private addAudit(entry: SecretAuditEntry): void {
    this.auditLog.push(entry);
    if (this.auditLog.length > this.maxAuditEntries) {
      this.auditLog.shift();
    }
  }
}
