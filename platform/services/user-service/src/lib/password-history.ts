// 비밀번호 이력 관리
// Design Ref: SVC-USER-R1 DESIGN §5
// Plan SC: FR-USR.5
// CSAP: D-08-07 비밀번호 재사용 방지

import bcrypt from 'bcryptjs';

/** 비밀번호 이력 보관 수 (환경 변수, 기본 5개) */
const HISTORY_COUNT = parseInt(
  process.env['PASSWORD_HISTORY_COUNT'] ?? '5',
  10,
);

/**
 * 인메모리 비밀번호 이력 저장소
 * Map<userId, hashedPassword[]> -- 최근 N개만 유지
 *
 * NOTE: 단일 인스턴스 환경 전용. Phase 2에서 DB 테이블로 마이그레이션 예정.
 */
const passwordHistoryStore = new Map<string, string[]>();

/**
 * 비밀번호 재사용 여부 검사
 *
 * 최근 N개의 비밀번호 해시와 새 비밀번호를 비교합니다.
 * bcrypt.compare를 사용하므로 솔트가 달라도 정확히 비교됩니다.
 *
 * @param userId - 사용자 ID
 * @param newPassword - 새 비밀번호 (평문)
 * @returns true이면 재사용, false이면 신규
 */
export async function isPasswordReused(
  userId: string,
  newPassword: string,
): Promise<boolean> {
  const history = passwordHistoryStore.get(userId) ?? [];

  for (const oldHash of history) {
    const match = await bcrypt.compare(newPassword, oldHash);
    if (match) return true;
  }

  return false;
}

/**
 * 비밀번호 이력에 새 해시 추가
 *
 * 최근 N개까지만 유지합니다 (FIFO).
 *
 * @param userId - 사용자 ID
 * @param passwordHash - bcrypt 해시된 비밀번호
 */
export function addPasswordHistory(
  userId: string,
  passwordHash: string,
): void {
  const history = passwordHistoryStore.get(userId) ?? [];
  history.unshift(passwordHash);

  // 최대 N개 유지
  while (history.length > HISTORY_COUNT) {
    history.pop();
  }

  passwordHistoryStore.set(userId, history);
}

/**
 * 비밀번호 이력 조회 (테스트용)
 */
export function getPasswordHistoryCount(userId: string): number {
  return (passwordHistoryStore.get(userId) ?? []).length;
}

/**
 * 비밀번호 이력 초기화 (테스트용)
 */
export function clearPasswordHistory(userId: string): void {
  passwordHistoryStore.delete(userId);
}

/**
 * 설정된 이력 보관 수 반환
 */
export function getHistoryCount(): number {
  return HISTORY_COUNT;
}
