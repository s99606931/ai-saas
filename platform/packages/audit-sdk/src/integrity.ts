// 감사 로그 무결성 검증
// Design Ref: D-P00.4
// CSAP: D-06 — SHA-256 체인 무결성

import type { AuditEntry } from '@public-saas/types';

/**
 * SHA-256 해시 계산
 *
 * 감사 로그 엔트리의 핵심 필드를 연결하여 SHA-256 해시를 생성합니다.
 * 이전 해시를 포함하여 체인 무결성을 보장합니다.
 *
 * @param entry - 감사 로그 엔트리
 * @returns SHA-256 해시 문자열 (hex)
 */
export async function computeHash(entry: AuditEntry): Promise<string> {
  const data = [
    entry.id,
    entry.actor,
    entry.action,
    entry.target,
    entry.targetType,
    entry.tenantId,
    entry.timestamp,
    entry.previousHash,
  ].join('|');

  // Web Crypto API (Node.js 20+ 및 브라우저 공통 지원)
  const encoder = new TextEncoder();
  const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', encoder.encode(data));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * 감사 로그 체인 무결성 검증
 *
 * 연속된 감사 로그 엔트리의 해시 체인이 유효한지 검증합니다.
 *
 * @param entries - 시간순으로 정렬된 감사 로그 엔트리 배열
 * @returns 무결성 검증 결과
 */
export async function verifyChainIntegrity(entries: AuditEntry[]): Promise<{ valid: boolean; brokenAt?: number }> {
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    if (!entry) continue;

    // 해시 재계산
    const originalHash = entry.hash;
    const recomputedHash = await computeHash({ ...entry, hash: '' });

    if (originalHash !== recomputedHash) {
      return { valid: false, brokenAt: i };
    }

    // 체인 연결 검증 (첫 번째 엔트리 제외)
    if (i > 0) {
      const previousEntry = entries[i - 1];
      if (previousEntry && entry.previousHash !== previousEntry.hash) {
        return { valid: false, brokenAt: i };
      }
    }
  }

  return { valid: true };
}
