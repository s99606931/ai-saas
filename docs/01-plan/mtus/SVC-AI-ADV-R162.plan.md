# MTU Plan — SVC-AI-ADV-R162 Response Time SLA Tracker

> **원 요청 번호**: R162
> **모듈**: `platform/services/ai-service/src/lib/response-time-sla-tracker.ts`

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | AI 응답 시간 SLA 위반 실시간 추적 → 사용자 체감 품질 보장 |
| 기술 | 시간창 기반 집계 + 임계값 초과 시 위반 알림 생성 |
| 보안 | C/S 차단, 감사 로그 |
| 규제 | CSAP D-06, 행안부 정보화사업 SLA 표준 |

## Context Anchor

- WHY: 5초 넘는 AI 응답은 민원 이탈률 급증 → SLA 추적 필수
- WHO: SRE 팀, 운영 대시보드
- RISK: SLA 위반 미탐지 → 계약 위약금
- SUCCESS: p50/p95/p99 계산, 위반 알림 자동 생성
- SCOPE: record(latencyMs, grade), getPercentiles(), getViolations()

## FR

| ID | 설명 |
|----|------|
| FR-R162.1 | record(latencyMs, grade): 응답 시간 기록 |
| FR-R162.2 | SLA 임계값: p95 ≤ 2000ms, p99 ≤ 5000ms (설정 가능) |
| FR-R162.3 | getPercentiles(): { p50, p95, p99 } 반환 |
| FR-R162.4 | p95/p99 임계값 초과 시 위반 알림 생성 |
| FR-R162.5 | getViolations(): 위반 이력 반환 |
| FR-R162.6 | 시간창 설정 (기본 최근 100 샘플) |
| FR-R162.7 | C/S 등급 차단 |
| FR-R162.8 | getStats(), getAuditLog() |

## 테스트 케이스

- 샘플 미만 → percentiles null
- 100 샘플 기록 후 p50/p95/p99 계산
- p95 초과 기록 → 위반 알림 생성
- 시간창 초과 시 오래된 샘플 제거
- getViolations 이력 반환
- 음수 latency → invalid_latency
- C/S 차단
- 감사 로그 기록
