# SVC-AI-ADV-R433 Plan — Online Voting Integrity Verifier AI

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 온라인 투표 부정 행위(중복/봇/시간 이상) 탐지 |
| WHO | 선관위, 전자투표 운영기관 |
| WHAT | 투표 이벤트 로그 → 이상 패턴 탐지 → 무효 후보 목록 |
| HOW | 중복 IP + 짧은 투표 간격 + 미성년/봇 탐지 규칙 |

## Context Anchor
- WHY: 투표 무결성은 민주주의 핵심
- WHO: 선거 감시관
- RISK: 오탐 시 정당 투표 무효 위험
- SUCCESS: 부정 투표 탐지율 ≥ 95%, 오탐 < 2%
- SCOPE: `online-voting-integrity-verifier-ai.ts`

## 요구사항
- FR-433.1: 동일 voterId 복수 투표 → 'DUPLICATE'
- FR-433.2: 동일 IP에서 n>5건 투표 → 'SUSPICIOUS_IP'
- FR-433.3: 이전 투표와 간격 < 2초 → 'BOT_SPEED'
- FR-433.4: 결과 = { suspicious: VoteEvent[], reasons: Map<id, reason[]> }
- FR-433.5: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-433.* ↔ `online-voting-integrity-verifier-ai.ts` ↔ 테스트 ↔ CSAP D-06/D-12 N2SF N-05
