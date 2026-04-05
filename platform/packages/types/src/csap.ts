// CSAP/N2SF 타입
// Design Ref: D-P00.2
// CSAP: 전체 79항목, N2SF: 6영역

/**
 * 데이터 등급 (N2SF)
 * - C: 기밀 — AI API 전송 절대 금지
 * - S: 민감 — AI API 전송 절대 금지
 * - O: 공개 — PII 마스킹 후 AI API 전송 가능
 */
export type DataGrade = 'C' | 'S' | 'O';

/**
 * N2SF 보안 영역 (6개)
 */
export type N2sfDomain = 'N-01' | 'N-02' | 'N-03' | 'N-04' | 'N-05' | 'N-06';

/**
 * CSAP 통제항목
 */
export interface CsapControl {
  /** CSAP 항목 ID (CSAP-DXX-YY) */
  id: string;
  /** 분야 (D01~D13) */
  domain: string;
  /** 항목명 */
  name: string;
  /** 준수 상태 */
  status: 'compliant' | 'non_compliant' | 'partial' | 'not_applicable';
  /** 증적 자료 경로 */
  evidence?: string;
  /** 마지막 검증 일시 */
  lastCheckedAt?: Date;
}
