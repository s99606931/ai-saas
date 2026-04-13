# SVC-AI-ADV-R440 Plan — AI기반 공공기관 의사소통 패턴 분석

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 공공기관 내부 의사소통 비효율 패턴을 AI로 감지하여 업무 개선 |
| WHO | 조직 관리자, 인사담당자 |
| RISK | PII(직원 ID) 마스킹 필수 |
| SUCCESS | SC-R440-1: 커뮤니케이션 이벤트 등록 / SC-R440-2: 채널별 효율성 계산 / SC-R440-3: C/S 등급 차단 |
| SCOPE | communication-pattern-analyzer-ai.ts 구현 |

## 요구사항
- FR-R440.1: 커뮤니케이션 이벤트 등록 (eventId, channel, participantId, durationMs)
- FR-R440.2: PII 마스킹 (participantId → SHA-256 16자 hex)
- FR-R440.3: 채널별 평균 응답 시간 계산
- FR-R440.4: 비효율 패턴 탐지 (avgDurationMs > threshold)
- FR-R440.5: N2SF N-05 C/S 등급 차단

## 추적성
FR-R440.* ↔ `communication-pattern-analyzer-ai.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
