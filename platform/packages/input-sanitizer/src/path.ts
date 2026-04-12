// 경로 격리 (Path Traversal 방어)
// Plan SC: FR-IS.4
// CSAP: D-12, OWASP A01 Broken Access Control

import { resolve, relative, isAbsolute } from 'node:path';

/**
 * target 경로가 base 디렉토리 하위인지 검증
 * Plan SC: FR-IS.4
 *
 * @returns true이면 안전 (base 하위), false이면 탈출 시도
 */
export function containPath(base: string, target: string): boolean {
  if (typeof base !== 'string' || typeof target !== 'string') {
    return false;
  }
  if (base.length === 0) return false;

  const absBase = resolve(base);
  const absTarget = resolve(absBase, target);
  const rel = relative(absBase, absTarget);

  if (rel === '') return true;
  if (rel.startsWith('..')) return false;
  if (isAbsolute(rel)) return false;
  return true;
}
