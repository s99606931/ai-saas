# SVC-AI-ADV-R441 Plan — 공공 서비스 자동화 워크플로우 빌더 (DSL)

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 민원·행정 반복 업무 자동화를 코드 없이 DSL로 선언 |
| WHO | 행정 자동화 담당관 |
| WHAT | DSL 정의 → 순차/조건 실행 → 결과 기록 |
| HOW | step(type, when, action) 배열 + runner 순차 실행 |

## Context Anchor
- WHY: 반복 민원 업무 자동화
- WHO: 행정 자동화 운영팀
- RISK: DSL 오류 → 실행 중단 → 감사 로그 필수
- SUCCESS: 조건 분기 + 중단 복구 100%
- SCOPE: `public-workflow-builder.ts`

## 요구사항
- FR-441.1: Step = { id, type: 'action'|'branch', when?: expr, action: string }
- FR-441.2: when 표현식은 ctx[key] 단순 비교만 (eq, ne, gt, lt)
- FR-441.3: run(dsl, ctx) → 순차 실행, when 불일치 시 스킵
- FR-441.4: action 실행 결과 → ctx에 병합
- FR-441.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-441.* ↔ `public-workflow-builder.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
