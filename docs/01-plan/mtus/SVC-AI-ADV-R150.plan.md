# MTU Plan — SVC-AI-ADV-R150 Sentiment-Based Router

> **원 요청 번호**: R150
> **모듈**: `platform/services/ai-service/src/lib/sentiment-based-router.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 부정·긴급 민원 자동 우선순위 라우팅 → SLA 위반 최소화 |
| 기술 | 키워드 가중치 기반 감성 점수 + 긴급도 산출 + 큐 분기 |
| 보안 | 민원인 해시 유지, 개인정보 마스킹 |
| 규제 | 민원사무처리법, 행안부 민원처리 표준 |

## Context Anchor

- WHY: 기존 sentiment-analysis-engine(단일 분석)·complaint-sentiment-analyzer(통계)와 별개로 **라우팅 결정 전용** 모듈
- WHO: 민원 접수 시스템, 상담사 배정 시스템
- RISK: 긴급 민원이 일반 큐에 방치되어 SLA 위반
- SUCCESS: 부정 강도 + 긴급 키워드 → HIGH 큐 즉시 배정
- SCOPE: route(text) → sentiment score + urgency → queue(HIGH/NORMAL/LOW)

## FR

| ID | 설명 |
|----|------|
| FR-R150.1 | 부정 키워드 가중치: 불만/억울/화가/분노/실망 등 |
| FR-R150.2 | 긴급 키워드 가중치: 긴급/당장/즉시/응급/생명/위험 |
| FR-R150.3 | routeScore = negativeWeight*0.6 + urgencyWeight*0.4 |
| FR-R150.4 | Queue 분기: HIGH (>=0.7) / NORMAL (0.3~0.7) / LOW (<0.3) |
| FR-R150.5 | RouteDecision(queue, score, negativeHits, urgencyHits, reasons) |
| FR-R150.6 | C/S 차단 + 감사 로그 + 빈 텍스트 거부 |

## 테스트 케이스

- 중립 텍스트 → LOW
- 부정 키워드만 → NORMAL
- 긴급 키워드만 → NORMAL 이상
- 부정+긴급 → HIGH
- 매우 강한 부정 → HIGH
- 키워드 다수 감지
- 정규화: 소문자/한국어 포함
- 빈 텍스트 invalid_input
- C/S 차단
- getAuditLog
