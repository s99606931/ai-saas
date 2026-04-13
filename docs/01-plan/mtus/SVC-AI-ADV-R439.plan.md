# SVC-AI-ADV-R439 Plan — Open Data Quality Manager AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공 개방 데이터셋 품질 자동 채점 및 등급화 |
| WHO | 행안부, 공공데이터포털 운영기관 |
| WHAT | 메타데이터 + 샘플 통계 → 4개 차원 점수 → 등급 |
| HOW | 완전성/정확성/최신성/일관성 가중합 |

## Context Anchor
- WHY: 데이터 활용도 향상
- WHO: 데이터 개방 담당자
- RISK: 자동 채점 오탐으로 낮은 점수 분쟁
- SUCCESS: 4차원 전체 평가, 등급 명시
- SCOPE: `opendata-quality-manager-ai.ts`

## 요구사항
- FR-439.1: completeness = 1 - (nullCount / totalRows)
- FR-439.2: freshness: 최근 업데이트가 30일 이내 → 1, 90일 이내 → 0.6, 이후 → 0.3
- FR-439.3: accuracy = 1 - (invalidCount / totalRows)
- FR-439.4: consistency = 1 - (schemaViolations / totalRows)
- FR-439.5: 종합 = 0.3*완전 + 0.2*신선 + 0.3*정확 + 0.2*일관 → A(≥0.9)/B(≥0.7)/C(≥0.5)/D
- N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-439.* ↔ `opendata-quality-manager-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
