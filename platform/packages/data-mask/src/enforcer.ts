// 데이터 등급 강제 가드
// Plan SC: FR-DM.9
// CLAUDE.md §1: AI API 호출 시 N2SF C/S 등급 데이터 전송 절대 금지

import { DataGradeViolationError, type DataGrade } from './types.js';

/**
 * 데이터 등급 검증 (위반 시 예외)
 *
 * @example
 *   enforceGrade('C', ['O']); // throws DataGradeViolationError
 *   enforceGrade('O', ['O']); // ok
 */
export function enforceGrade(
  grade: DataGrade,
  allowed: DataGrade[],
): void {
  if (!allowed.includes(grade)) {
    throw new DataGradeViolationError(grade, allowed);
  }
}

/**
 * AI API 호출 전용 가드: O 등급만 허용
 */
export function enforceAiSafe(grade: DataGrade): void {
  enforceGrade(grade, ['O']);
}
