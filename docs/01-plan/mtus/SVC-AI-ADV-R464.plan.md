# SVC-AI-ADV-R464 Plan — 정부 챗봇 응답 품질 평가기

## Executive Summary
| 관점 | 내용 |
|------|------|
| WHY | 정부 챗봇 응답 품질 자동 평가로 서비스 신뢰도 향상 |
| WHO | 국민민원상담센터, 디지털정부 서비스 운영팀 |
| WHAT | 질문·응답 쌍 → 품질 점수 + 개선 제안 |
| HOW | 관련성·명확성·완결성 3축 채점 |

## Context Anchor
- WHY: 챗봇 응답 품질 검증 표준화 필요
- WHO: 챗봇 운영자
- RISK: 평가 편향 → 3축 가중합
- SUCCESS: 평가자 간 일치도 ≥ 80%
- SCOPE: `gov-chatbot-quality-evaluator.ts`

## 요구사항
- FR-464.1: `ChatPair = { question, answer, keywords: string[] }`
- FR-464.2: `evaluate(pair)` → `{ relevance, clarity, completeness, totalScore: 0..100, grade: 'A'|'B'|'C'|'D' }`
- FR-464.3: relevance = answer에 포함된 keywords 비율 × 100
- FR-464.4: clarity = 100 - (answer.length 초과 150자당 10 감점)
- FR-464.5: completeness = keywords 전체 포함 시 100, 부분 시 비율
- FR-464.6: totalScore ≥ 85 A, ≥ 70 B, ≥ 55 C, else D
- FR-464.7: N2SF C/S 차단 + `getAuditLog()`

## 추적성
FR-464.* ↔ `gov-chatbot-quality-evaluator.ts` ↔ 테스트 ↔ CSAP D-06 N2SF N-05
