# SVC-AI-ADV-R438 Plan — Disaster Pre-Alert Auto Issuer AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 기상/지진/홍수 데이터 기반 경보 수준 자동 결정 |
| WHO | 기상청, 행안부 재난안전관리본부 |
| WHAT | 센서 데이터 → 위험 평가 → 경보 단계(주의/경계/심각) |
| HOW | 종류별 임계값 테이블 + 상한 기반 단계 결정 |

## Context Anchor
- WHY: 골든타임 확보, 인명 피해 최소화
- WHO: 재난 상황실 담당자
- RISK: 오경보 피로, 미발령 피해 — 보수적 기준 필요
- SUCCESS: 심각 단계 누락 0건
- SCOPE: `disaster-pre-alert-issuer-ai.ts`

## 요구사항
- FR-438.1: 지원 종류: RAINFALL(mm/h), SEISMIC(magnitude), FLOOD(waterLevel m)
- FR-438.2: 임계값 초과 시 단계 결정 (CAUTION/WARNING/SEVERE)
- FR-438.3: 알려지지 않은 kind → 오류
- FR-438.4: 결과 = { kind, level, metric, threshold, issuedAt }
- FR-438.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-438.* ↔ `disaster-pre-alert-issuer-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
