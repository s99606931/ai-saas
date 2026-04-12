// 데이터 등급 + 마스킹 정책 타입
// Plan SC: FR-DM.8, FR-DM.9, FR-DM.10
// CSAP: D-09, N2SF N-05

/** N2SF 데이터 등급 (C: Critical, S: Sensitive, O: Open) */
export type DataGrade = 'C' | 'S' | 'O';

export type PiiType =
  | 'ssn'
  | 'phone'
  | 'landline'
  | 'email'
  | 'card'
  | 'account'
  | 'address'
  | 'key';

export interface MaskEvent {
  type: PiiType;
  /** 매칭 발생 위치 또는 키 */
  location?: string;
}

export interface MaskPolicy {
  /** 키 이름이 매칭되면 [MASKED] 처리 */
  maskedKeys?: string[];
  /** 키 이름 정규식 */
  maskedKeyPatterns?: RegExp[];
  /** 마스킹 이벤트 콜백 (감사 훅) */
  onMask?: (event: MaskEvent) => void;
  /** 활성화할 PII 타입 (default: 모두) */
  enabledTypes?: PiiType[];
}

export class DataGradeViolationError extends Error {
  constructor(
    public readonly grade: DataGrade,
    public readonly allowed: DataGrade[],
  ) {
    super(
      `Data grade '${grade}' is not allowed (allowed: ${allowed.join(', ')}).`,
    );
    this.name = 'DataGradeViolationError';
  }
}
