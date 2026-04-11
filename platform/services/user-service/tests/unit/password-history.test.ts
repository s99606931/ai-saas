// 비밀번호 이력 관리 단위 테스트
// Design Ref: SVC-USER-R1 DESIGN §5
// Plan SC: FR-USR.5
// CSAP: D-08-07 비밀번호 재사용 방지

import { describe, it, expect, beforeEach } from 'vitest';
import bcrypt from 'bcryptjs';
import {
  isPasswordReused,
  addPasswordHistory,
  getPasswordHistoryCount,
  clearPasswordHistory,
  getHistoryCount,
} from '../../src/lib/password-history.js';

describe('비밀번호 이력 관리 (CSAP D-08-07)', () => {
  const userId = 'test-user-1';

  beforeEach(() => {
    clearPasswordHistory(userId);
  });

  it('이력이 비어있으면 재사용이 아니다', async () => {
    expect(await isPasswordReused(userId, 'NewP@ss1!')).toBe(false);
  });

  it('동일한 비밀번호를 재사용으로 감지한다', async () => {
    const password = 'MyP@ssw0rd!';
    const hash = await bcrypt.hash(password, 4); // 테스트 속도를 위해 낮은 cost
    addPasswordHistory(userId, hash);

    expect(await isPasswordReused(userId, password)).toBe(true);
  });

  it('다른 비밀번호는 재사용이 아니다', async () => {
    const oldPassword = 'OldP@ss1!';
    const hash = await bcrypt.hash(oldPassword, 4);
    addPasswordHistory(userId, hash);

    expect(await isPasswordReused(userId, 'NewP@ss2!')).toBe(false);
  });

  it('여러 이력 중 하나와 일치하면 재사용', async () => {
    const passwords = ['Pass1!Aa', 'Pass2!Bb', 'Pass3!Cc'];
    for (const pw of passwords) {
      const hash = await bcrypt.hash(pw, 4);
      addPasswordHistory(userId, hash);
    }

    expect(await isPasswordReused(userId, 'Pass2!Bb')).toBe(true);
    expect(await isPasswordReused(userId, 'Pass4!Dd')).toBe(false);
  });

  it('이력에 비밀번호 해시를 추가한다', () => {
    expect(getPasswordHistoryCount(userId)).toBe(0);
    addPasswordHistory(userId, 'hash1');
    expect(getPasswordHistoryCount(userId)).toBe(1);
    addPasswordHistory(userId, 'hash2');
    expect(getPasswordHistoryCount(userId)).toBe(2);
  });

  it('이력은 최대 N개까지만 유지한다 (FIFO)', () => {
    const maxCount = getHistoryCount();
    for (let i = 0; i < maxCount + 3; i++) {
      addPasswordHistory(userId, `hash-${i}`);
    }
    expect(getPasswordHistoryCount(userId)).toBe(maxCount);
  });

  it('이력을 초기화한다', () => {
    addPasswordHistory(userId, 'hash1');
    addPasswordHistory(userId, 'hash2');
    clearPasswordHistory(userId);
    expect(getPasswordHistoryCount(userId)).toBe(0);
  });

  it('사용자별로 독립적인 이력을 유지한다', () => {
    const userId2 = 'test-user-2';
    addPasswordHistory(userId, 'hash-a');
    addPasswordHistory(userId2, 'hash-b');
    addPasswordHistory(userId2, 'hash-c');

    expect(getPasswordHistoryCount(userId)).toBe(1);
    expect(getPasswordHistoryCount(userId2)).toBe(2);

    clearPasswordHistory(userId2);
  });

  it('이력 보관 수는 기본 5개이다', () => {
    expect(getHistoryCount()).toBe(5);
  });
});
