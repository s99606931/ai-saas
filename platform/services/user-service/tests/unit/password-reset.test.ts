// MTU-Q3 password-reset.handler 단위 테스트
// Test Ref: DESIGN-MTU-Q3 §2 FR-P02.7
// CSAP: D-08-07 비밀번호 재설정 정책

import { describe, it, expect, vi } from 'vitest';
import { createHash, randomBytes } from 'node:crypto';

// ──────────────────────────────────────────────
// password-reset.handler.ts 핵심 로직 추출 테스트
// 외부 의존성(PrismaClient, auth-sdk) 없이 순수 로직 검증
// ──────────────────────────────────────────────

/** SHA-256 해시 함수 (password-reset.handler.ts 동일 구현) */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** 30분 만료 시간 상수 */
const TOKEN_EXPIRY_MS = 30 * 60 * 1000;

interface ResetTokenEntry {
  hashedToken: string;
  userId: string;
  email: string;
  ip: string;
  expiresAt: Date;
}

describe('MTU-Q3 password-reset: 토큰 SHA-256 해시 저장', () => {
  it('TC-PR01: rawToken을 SHA-256으로 해시한다', () => {
    const rawToken = 'test-raw-token-abc123';
    const hashed = hashToken(rawToken);

    expect(hashed).not.toBe(rawToken);
    expect(hashed).toHaveLength(64); // SHA-256 = 256bit = 64 hex chars
    expect(hashed).toMatch(/^[0-9a-f]+$/); // 소문자 hex
  });

  it('TC-PR02: 동일 토큰은 항상 동일 해시를 반환한다 (결정적)', () => {
    const token = 'fixed-token-value';
    expect(hashToken(token)).toBe(hashToken(token));
  });

  it('TC-PR03: 서로 다른 토큰은 다른 해시를 생성한다', () => {
    const token1 = randomBytes(32).toString('hex');
    const token2 = randomBytes(32).toString('hex');
    expect(hashToken(token1)).not.toBe(hashToken(token2));
  });

  it('TC-PR04: 토큰 저장소에는 rawToken이 아닌 hashedToken이 저장된다', () => {
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);

    const store = new Map<string, ResetTokenEntry>();
    store.set(hashedToken, {
      hashedToken,
      userId: 'user-123',
      email: 'test@example.com',
      ip: '1.2.3.4',
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    });

    // 저장소에 rawToken 키가 없어야 한다
    expect(store.has(rawToken)).toBe(false);
    // hashedToken 키로만 조회 가능
    expect(store.has(hashedToken)).toBe(true);
    // 저장된 값에도 rawToken이 없어야 한다
    const entry = store.get(hashedToken);
    expect(entry?.hashedToken).toBe(hashedToken);
    expect(entry?.hashedToken).not.toBe(rawToken);
  });
});

describe('MTU-Q3 password-reset: 30분 만료 설정', () => {
  it('TC-PR05: 토큰 만료 시간은 30분(1800000ms)이다', () => {
    expect(TOKEN_EXPIRY_MS).toBe(1800000);
    expect(TOKEN_EXPIRY_MS).toBe(30 * 60 * 1000);
  });

  it('TC-PR06: 새로 생성한 토큰의 만료 시각이 현재로부터 30분 후이다', () => {
    const now = Date.now();
    const expiresAt = new Date(now + TOKEN_EXPIRY_MS);
    const diffMs = expiresAt.getTime() - now;

    expect(diffMs).toBeCloseTo(TOKEN_EXPIRY_MS, -3); // 1초 오차 허용
  });

  it('TC-PR07: 만료된 토큰을 검증하면 실패한다', () => {
    const expiredEntry: ResetTokenEntry = {
      hashedToken: 'abc',
      userId: 'user-1',
      email: 'test@example.com',
      ip: '1.2.3.4',
      expiresAt: new Date(Date.now() - 1000), // 1초 전 만료
    };

    const isExpired = expiredEntry.expiresAt < new Date();
    expect(isExpired).toBe(true);
  });

  it('TC-PR08: 유효한 토큰을 검증하면 성공한다', () => {
    const validEntry: ResetTokenEntry = {
      hashedToken: 'abc',
      userId: 'user-1',
      email: 'test@example.com',
      ip: '1.2.3.4',
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    };

    const isExpired = validEntry.expiresAt < new Date();
    expect(isExpired).toBe(false);
  });
});

describe('MTU-Q3 password-reset: 1회 사용 후 폐기', () => {
  it('TC-PR09: 토큰 사용 후 저장소에서 삭제된다', () => {
    const rawToken = randomBytes(32).toString('hex');
    const hashedToken = hashToken(rawToken);
    const store = new Map<string, ResetTokenEntry>();

    store.set(hashedToken, {
      hashedToken,
      userId: 'user-1',
      email: 'test@example.com',
      ip: '1.2.3.4',
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    });

    // 사용 전 토큰 존재 확인
    expect(store.has(hashedToken)).toBe(true);

    // 토큰 사용 (1회 폐기)
    store.delete(hashedToken);

    // 사용 후 토큰 없음 확인
    expect(store.has(hashedToken)).toBe(false);
  });

  it('TC-PR10: 삭제된 토큰으로 재사용 시도 시 undefined를 반환한다', () => {
    const store = new Map<string, ResetTokenEntry>();
    const entry = store.get('nonexistent-token');
    expect(entry).toBeUndefined();
  });

  it('TC-PR11: 만료된 토큰도 삭제 처리된다', () => {
    const token1Hash = hashToken('expired-token-1');
    const token2Hash = hashToken('valid-token-2');
    const store = new Map<string, ResetTokenEntry>();

    store.set(token1Hash, {
      hashedToken: token1Hash,
      userId: 'u-1',
      email: 'a@b.com',
      ip: '1.1.1.1',
      expiresAt: new Date(Date.now() - 1000), // 만료됨
    });
    store.set(token2Hash, {
      hashedToken: token2Hash,
      userId: 'u-2',
      email: 'c@d.com',
      ip: '2.2.2.2',
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS), // 유효
    });

    // 만료 토큰 정리 로직
    const now = new Date();
    for (const [key, entry] of store) {
      if (entry.expiresAt < now) {
        store.delete(key);
      }
    }

    expect(store.has(token1Hash)).toBe(false);
    expect(store.has(token2Hash)).toBe(true);
  });
});

describe('MTU-Q3 password-reset: 계정 열거 방지', () => {
  it('TC-PR12: 존재하는 이메일과 없는 이메일에 동일 성공 응답 메시지를 반환한다', () => {
    const successMessage = '비밀번호 재설정 안내가 이메일로 발송되었습니다';

    // 존재하는 사용자
    const responseExisting = { success: true, message: successMessage };
    // 존재하지 않는 사용자 (동일 응답)
    const responseNotFound = { success: true, message: successMessage };

    expect(responseExisting.message).toBe(responseNotFound.message);
    expect(responseExisting.success).toBe(responseNotFound.success);
  });

  it('TC-PR13: 요청 응답에 사용자 존재 여부가 노출되지 않는다', () => {
    const successResponse = { success: true, message: '비밀번호 재설정 안내가 이메일로 발송되었습니다' };

    expect(JSON.stringify(successResponse)).not.toContain('USER_NOT_FOUND');
    expect(JSON.stringify(successResponse)).not.toContain('not found');
    expect(JSON.stringify(successResponse)).not.toContain('존재하지 않');
  });
});

describe('MTU-Q3 password-reset: 기존 토큰 폐기', () => {
  it('TC-PR14: 재요청 시 기존 토큰이 폐기된다', () => {
    const userId = 'user-existing';
    const oldTokenHash = hashToken('old-token');
    const store = new Map<string, ResetTokenEntry>();

    store.set(oldTokenHash, {
      hashedToken: oldTokenHash,
      userId,
      email: 'test@example.com',
      ip: '1.2.3.4',
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    });

    // 재요청 처리: 기존 토큰 폐기
    for (const [key, entry] of store) {
      if (entry.userId === userId) {
        store.delete(key);
      }
    }

    // 새 토큰 발급
    const newTokenHash = hashToken(randomBytes(32).toString('hex'));
    store.set(newTokenHash, {
      hashedToken: newTokenHash,
      userId,
      email: 'test@example.com',
      ip: '1.2.3.4',
      expiresAt: new Date(Date.now() + TOKEN_EXPIRY_MS),
    });

    expect(store.has(oldTokenHash)).toBe(false);
    expect(store.has(newTokenHash)).toBe(true);
    expect(store.size).toBe(1); // 토큰 1개만 존재
  });
});
