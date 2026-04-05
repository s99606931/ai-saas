// N2SF 데이터 등급 검증
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.2
// CSAP: N2SF N-05 — C/S등급 AI API 전송 절대 금지

import type { DataGrade } from '@public-saas/types';

/**
 * 데이터 등급 검증
 *
 * N2SF N-05 요건:
 * - C등급 (기밀): AI API 전송 절대 금지
 * - S등급 (민감): AI API 전송 절대 금지
 * - O등급 (공개): PII 마스킹 후 전송 가능
 *
 * @param grade - 데이터 등급
 * @throws C/S 등급 데이터 전송 시도 시 오류
 */
export function validateDataGrade(grade: DataGrade): void {
  if (grade === 'C' || grade === 'S') {
    throw new DataGradeViolationError(
      `BLOCKED: ${grade}등급 데이터는 AI API 전송이 금지됩니다 (N2SF N-05)`,
      grade,
    );
  }
}

/**
 * 데이터 등급 위반 오류
 */
export class DataGradeViolationError extends Error {
  public readonly grade: DataGrade;
  public readonly code = 'N2SF_DATA_GRADE_VIOLATION';

  constructor(message: string, grade: DataGrade) {
    super(message);
    this.name = 'DataGradeViolationError';
    this.grade = grade;
  }
}

/**
 * AI 모델이 허용하는 최대 등급과 요청 등급 비교
 *
 * @param modelMaxGrade - 모델이 허용하는 최대 등급
 * @param requestGrade - 요청 데이터 등급
 * @returns 전송 가능 여부
 */
export function canSendToModel(
  modelMaxGrade: DataGrade,
  requestGrade: DataGrade,
): boolean {
  const gradeOrder: Record<DataGrade, number> = { O: 0, S: 1, C: 2 };
  return gradeOrder[requestGrade] <= gradeOrder[modelMaxGrade];
}
