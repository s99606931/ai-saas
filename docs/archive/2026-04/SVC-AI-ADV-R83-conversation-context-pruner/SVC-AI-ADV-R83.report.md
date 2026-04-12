# SVC-AI-ADV-R83 — 보고서

## Executive Summary
| 관점 | 목표 | 달성 |
|---|---|---|
| 비즈니스 | 토큰 40% 절감 | 테스트상 40+ % 절감 확인 |
| 기술 | 점수 기반 pruning + 요약 | system/user/최근/키워드 가중 |
| 보안 | PII 마스킹 | 3종 정규식 |
| 규정 | 감사 추적 | 이벤트 6종 |

## Key Decisions
- **강제 보존 집합**: system + keepLastN(기본 4) → 핵심 맥락 손실 방지
- **요약 턴 삽입 실패 허용**: summarizer 오류 시 단순 제거로 degrade
- **기존 `conversational-memory.ts`와 분리**: 저장이 아닌 압축 알고리즘 전용

## 테스트 16/16 통과
