# SVC-AI-ADV-R427 Plan — Public Asset Manager AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 공공 자산(건물/장비/차량) 내용연수·상태 기반 처분 시점 예측 |
| WHO | 재산관리팀, 회계과 |
| WHAT | 자산 데이터 → KEEP/REVIEW/DISPOSE 권고 |
| HOW | ageRatio = 경과연수/내용연수 + condition 강제 규칙 |

## Context Anchor
- WHY: 노후 자산 유지비 과다 방지
- WHO: 재산관리팀
- RISK: 성급한 처분 권고 방지
- SUCCESS: 처분 시점 예측 ±6개월
- SCOPE: `public-asset-manager-ai.ts`

## 요구사항
- FR-427.1: ageRatio = elapsedYears / usefulLifeYears
- FR-427.2: <0.7 → 'KEEP', <1.0 → 'REVIEW', ≥1.0 → 'DISPOSE'
- FR-427.3: condition='BAD' → 강제 'DISPOSE'
- FR-427.4: N2SF C/S 차단
- FR-427.5: 감사 로그 + recommendationCode

## 추적성
FR-427.* ↔ `public-asset-manager-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
