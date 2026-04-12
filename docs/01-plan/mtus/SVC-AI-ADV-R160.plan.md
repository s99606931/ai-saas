# MTU Plan — SVC-AI-ADV-R160 Hallucination Scorer

> **원 요청 번호**: R160
> **모듈**: `platform/services/ai-service/src/lib/hallucination-scorer.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AI 응답의 환각 가능성을 정량 점수화하여 신뢰도 제공 |
| 기술 | 참조 근거(citations) vs 응답 토큰 일치도 + 불확실 표현 탐지 |
| 보안 | C/S 차단, 감사 로그 |
| 규제 | EU AI Act Art.15 (정확성), 행안부 AI 투명성 |

## Context Anchor

- WHY: 민원 답변에 환각 응답 노출 시 행정 오류 → 법적 책임
- WHO: AI 응답 검증 파이프라인, QA 팀
- RISK: 미탐지 환각 → 잘못된 행정 안내
- SUCCESS: 점수 0~1 반환, 0.7+ 이면 "high risk" 플래그
- SCOPE: score(response, citations[]) → { score, level, reasons[] }

## FR

| ID | 설명 |
|----|------|
| FR-R160.1 | score(response, citations): 0~1 점수 반환 |
| FR-R160.2 | level: 'low'(<0.3) / 'medium'(<0.7) / 'high'(≥0.7) |
| FR-R160.3 | 근거 인용률 = 응답 주요 토큰 중 citations에 포함된 비율 |
| FR-R160.4 | 불확실 표현 탐지: '아마', '~인 것 같', 'perhaps' 등 → 점수 가중치 |
| FR-R160.5 | citations 비어있음 → 자동 high (score=0.9) |
| FR-R160.6 | reasons[]: 점수 산출 근거 문자열 배열 |
| FR-R160.7 | C/S 등급 차단 |
| FR-R160.8 | getAuditLog(), getStats() |

## 테스트 케이스

- 근거 충분 + 일치도 높음 → low
- 근거 없음 → high (0.9)
- 불확실 표현 포함 → medium 이상
- 빈 응답 → empty_response
- reasons 에 산출 근거 포함
- C/S 차단
- 통계: 평균 점수, level별 카운트
- 감사 로그 기록
