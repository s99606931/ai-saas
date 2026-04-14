# SVC-AI-ADV-R659 Design — AI기반 민원인 리스크 프로파일링 v2

## Executive Summary
| 관점 | 내용 |
|------|------|
| 기능 | Plan FR-R659.1~6 구현 |
| 보안 | N2SF N-05, PII SHA-256, CSAP D-06 |
| 품질 | TypeScript strict, Vitest 6+ |
| 범위 | platform/services/ai-service/src/lib/citizen-risk-profiler-v2.ts |

## 설계 결정
- `CitizenRiskProfilerV2` 클래스
- 점수 = 이벤트 수 + 위협 키워드 수 * 3
- 위협 키워드: ['협박','자해','폭력','고소','시위']
- 등급: ≥10 HIGH, ≥4 MEDIUM, else LOW
- 모든 외부 노출 ID는 hashCitizenId

## 변경 이력
| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-14 | 최초 작성 | ai-impl-c |
