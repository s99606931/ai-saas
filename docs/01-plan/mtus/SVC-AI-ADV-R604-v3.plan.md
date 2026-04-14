# SVC-AI-ADV-R604 (v3) Plan — AI기반 컴플라이언스 갭 분석 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | CSAP/N2SF 통제항목 대비 현황 자동 비교하여 미준수 항목 우선 조치 |
| WHO | 컴플라이언스 담당, 감사 담당 |
| RISK | 미준수 항목 누락 방지 |
| SUCCESS | SC-R604v3-1: 통제 비교 / SC-R604v3-2: 갭 점수 / SC-R604v3-3: 우선순위 |
| SCOPE | compliance-gap-analyzer-v3.ts 구현 (트랙 A 22차) |

## 기능 요구사항
- FR-R604v3.1: 입력 (controls: {id, required: boolean, implemented: boolean, severity: 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'}[])
- FR-R604v3.2: gap = required && !implemented
- FR-R604v3.3: gapScore = sum(severity weight) (CRITICAL=10/HIGH=5/MEDIUM=2/LOW=1)
- FR-R604v3.4: 미준수 항목을 severity 내림차순 정렬
- FR-R604v3.5: 결과 = {totalControls, gaps: number, gapScore, prioritized: string[]}

## 추적성
FR-R604v3.* ↔ `compliance-gap-analyzer-v3.ts` ↔ 테스트 ↔ CSAP D-08
