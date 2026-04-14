# SVC-AI-ADV-R601 (v3) Plan — AI기반 정책 집행 자동화 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 정책 규칙을 자동 집행하여 정책 위반 사고 사전 차단 및 운영 일관성 확보 |
| WHO | 정책 운영자, 컴플라이언스 담당자 |
| RISK | C/S 등급 데이터 AI 전송 차단 + 잘못된 정책 차단으로 인한 업무 중단 방지 |
| SUCCESS | SC-R601v3-1: N2SF 등급 검사 / SC-R601v3-2: 정책 위반 감지 / SC-R601v3-3: 감사 로그 |
| SCOPE | ai-policy-enforcement-v3.ts 구현 (트랙 A 22차) |

## 기능 요구사항
- FR-R601v3.1: 입력 (id, grade: 'C'|'S'|'O', actorEmail, action, resource, attemptCount)
- FR-R601v3.2: N2SF C/S 등급 → `BLOCKED: C/S등급 AI API 전송 금지 (N2SF N-05)` 에러
- FR-R601v3.3: actorEmail PII → SHA-256 16자 hex 마스킹
- FR-R601v3.4: 정책 위반 감지 (action='DELETE'+resource='production' → CRITICAL, attemptCount>5 → HIGH, else LOW)
- FR-R601v3.5: 감사 로그 전수 기록 (`getAuditLog`)

## 추적성
FR-R601v3.* ↔ `ai-policy-enforcement-v3.ts` ↔ 테스트 ↔ CSAP D-06/D-08, N2SF N-05
