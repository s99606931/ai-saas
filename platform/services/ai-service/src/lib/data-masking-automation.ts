/**
 * Data Masking Automation — SVC-AI-ADV-R168 (트랙 B 4차)
 *
 * Design Ref: docs/archive/2026-04/SVC-AI-ADV-R168/SVC-AI-ADV-R168.design.md
 * Plan SC: FR-R168.1 ~ FR-R168.5
 *
 * 팀 리드 지정 파일명 버전. data-masking-automator.ts의 동일 기능.
 * CSAP D-12: PII/시크릿 마스킹 자동화. 외부 API 없음.
 */

export { DataMaskingAutomator as DataMaskingAutomation } from './data-masking-automator'
export type { MaskingPattern, MaskingResult, MaskingStats, AuditEntry } from './data-masking-automator'
