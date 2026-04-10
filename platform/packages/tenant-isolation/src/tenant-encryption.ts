// 테넌트별 AES-256 암호화
// Design Ref: SVC-TENANT-R14 Plan
// Plan SC: FR-TENANT.4
// CSAP: D-09 암호화

import { createCipheriv, createDecipheriv, randomBytes, createHmac } from 'node:crypto';
import { TenantContext } from './tenant-context.js';

/**
 * 암호화 결과
 */
export interface EncryptedData {
  /** 암호문 (hex) */
  ciphertext: string;
  /** 초기화 벡터 (hex) */
  iv: string;
  /** 인증 태그 (hex) -- GCM 모드 */
  authTag: string;
  /** 키 버전 (로테이션 지원) */
  keyVersion: number;
  /** 테넌트 ID */
  tenantId: string;
}

/**
 * 테넌트별 암호화 관리자
 *
 * AES-256-GCM + HKDF 기반 테넌트별 키 파생으로
 * 테넌트 간 암호화 데이터 완전 격리를 보장합니다.
 */
export class TenantEncryption {
  private readonly tenantContext: TenantContext;
  private readonly masterKey: Buffer;
  private readonly keyVersion: number;

  /**
   * @param tenantContext 테넌트 컨텍스트 관리자
   * @param masterKeyHex 마스터 키 (hex, 64자 = 256bit)
   * @param keyVersion 키 버전 (기본: 1)
   */
  constructor(tenantContext: TenantContext, masterKeyHex: string, keyVersion = 1) {
    if (masterKeyHex.length !== 64) {
      throw new Error('마스터 키는 256bit (hex 64자)여야 합니다');
    }
    this.tenantContext = tenantContext;
    this.masterKey = Buffer.from(masterKeyHex, 'hex');
    this.keyVersion = keyVersion;
  }

  /**
   * 현재 테넌트의 데이터 암호화
   *
   * AES-256-GCM 사용 (인증 + 암호화 동시)
   */
  encrypt(plaintext: string): EncryptedData {
    const tenantId = this.tenantContext.requireTenantId();
    const tenantKey = this.deriveTenantKey(tenantId);
    const iv = randomBytes(12); // GCM 표준 96-bit IV

    const cipher = createCipheriv('aes-256-gcm', tenantKey, iv);
    const encrypted = Buffer.concat([
      cipher.update(plaintext, 'utf8'),
      cipher.final(),
    ]);
    const authTag = cipher.getAuthTag();

    return {
      ciphertext: encrypted.toString('hex'),
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex'),
      keyVersion: this.keyVersion,
      tenantId,
    };
  }

  /**
   * 암호화 데이터 복호화
   *
   * 테넌트 ID 검증 후 복호화 수행
   */
  decrypt(data: EncryptedData): string {
    const currentTenantId = this.tenantContext.requireTenantId();
    const currentTenant = this.tenantContext.getCurrentTenant();

    // 테넌트 격리 검증: 다른 테넌트의 데이터 복호화 차단
    if (data.tenantId !== currentTenantId && !currentTenant?.isSuperAdmin) {
      throw new TenantEncryptionError(
        `테넌트 격리 위반: 현재 테넌트(${currentTenantId})가 다른 테넌트(${data.tenantId})의 데이터에 접근 시도`,
      );
    }

    const tenantKey = this.deriveTenantKey(data.tenantId);
    const iv = Buffer.from(data.iv, 'hex');
    const authTag = Buffer.from(data.authTag, 'hex');
    const ciphertext = Buffer.from(data.ciphertext, 'hex');

    const decipher = createDecipheriv('aes-256-gcm', tenantKey, iv);
    decipher.setAuthTag(authTag);

    const decrypted = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);

    return decrypted.toString('utf8');
  }

  /**
   * 테넌트별 고유 키 파생 (HKDF 방식)
   *
   * HMAC-SHA256(masterKey, "tenant:" + tenantId + ":v" + keyVersion)
   */
  deriveTenantKey(tenantId: string): Buffer {
    const info = `tenant:${tenantId}:v${this.keyVersion}`;
    const derived = createHmac('sha256', this.masterKey)
      .update(info)
      .digest();
    return derived; // 32 bytes = 256 bits
  }

  /**
   * 키 버전 반환
   */
  getKeyVersion(): number {
    return this.keyVersion;
  }
}

/**
 * 테넌트 암호화 에러
 */
export class TenantEncryptionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TenantEncryptionError';
  }
}
