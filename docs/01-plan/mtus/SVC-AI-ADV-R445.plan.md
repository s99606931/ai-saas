# SVC-AI-ADV-R445 Plan — AI 기반 법원 판례 요약기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 주요 쟁점/판시사항 자동 추출 → 연구 효율 |
| WHO | 법원, 검찰, 변호사, 로스쿨 |
| WHAT | 판결문 원문 → 쟁점/판시/결론 요약 |
| HOW | 섹션 키워드 기반 파싱 + 문단 추출 |

## Context Anchor
- WHY: 판례 연구 시간 단축
- WHO: 법원 자료실
- RISK: 오역 → 원문 링크 병기
- SUCCESS: 3개 섹션 추출 성공률
- SCOPE: `court-case-summarizer-ai.ts`

## 요구사항
- FR-445.1: 입력 = 판결문 원문 (문단 배열)
- FR-445.2: "쟁점"/"판시"/"결론" 키워드로 섹션 시작 탐지
- FR-445.3: 각 섹션 → 다음 섹션 전까지 병합
- FR-445.4: 결과 = { issues, rulings, conclusion, found: string[] }
- FR-445.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-445.* ↔ `court-case-summarizer-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
