# SVC-AI-ADV-R195 Plan: AI기반 민원 우선순위 자동 분류 v2

| 항목 | 내용 |
|------|------|
| MTU ID | SVC-AI-ADV-R195 |
| 기능명 | AI기반 민원 우선순위 자동 분류 v2 |
| 구현 파일 | complaint-priority-classifier-v2.ts |
| 작성일 | 2026-04-12 |

## 성공 기준
- SC01: N2SF N-05 C/S 등급 차단
- SC02: 긴급/위험 키워드, 반복 민원, 대기일수, 채널 가중치 합산
- SC03: CRITICAL(≥60)/HIGH(≥35)/NORMAL(≥15)/LOW 4단계
