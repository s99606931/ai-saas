# MTU Plan — SVC-AI-ADV-R163 Citizen Feedback Analyzer

> **원 요청 번호**: R163
> **모듈**: `platform/services/ai-service/src/lib/citizen-feedback-analyzer-r163.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 민원 피드백 자동 분석 — 감성/주제/긴급도 → 민원 처리 효율 |
| 기술 | 키워드 기반 감성 + 주제 분류 + 긴급도 점수 집계 |
| 보안 | C/S 등급 차단, PII 마스킹, 감사 로그 |
| 규제 | CSAP D-06 감사, N2SF O등급, 행안부 민원처리에 관한 법률 |

## Context Anchor

- WHY: 월 수만 건 민원 수동 분류 불가능 → 자동 분석 필수
- WHO: 민원 담당자, 운영 대시보드
- RISK: 긴급 민원 지연 처리 → 시민 불만 폭증, 언론 이슈
- SUCCESS: 감성/주제/긴급도 3개 축 분류, 긴급 건 즉시 알림
- SCOPE: analyze(text), getTrend(), getUrgentQueue()

## FR

| ID | 설명 |
|----|------|
| FR-R163.1 | analyze(text, grade): 감성(positive/neutral/negative) 판정 |
| FR-R163.2 | 주제 분류: 복지/세금/교통/환경/안전/기타 (키워드 사전) |
| FR-R163.3 | 긴급도 점수 0~100 (부정 감성 + 긴급 키워드 가중) |
| FR-R163.4 | 긴급도 ≥ 70 → 긴급 큐 등록 |
| FR-R163.5 | getTrend(): 주제별 건수 + 평균 긴급도 |
| FR-R163.6 | getUrgentQueue(): 긴급 민원 목록 |
| FR-R163.7 | C/S 등급 차단 (N2SF N-05) |
| FR-R163.8 | getStats(), getAuditLog() |

## 테스트 케이스

- 부정 감성 + 긴급 키워드 → 긴급 큐 등록
- 복지 키워드 → topic=welfare
- 긴 텍스트 정상 분석
- 빈 텍스트 → invalid_text
- C/S 차단
- getTrend 집계 정확성
- 중립 감성 케이스
- 감사 로그 기록
- 통계 반환
