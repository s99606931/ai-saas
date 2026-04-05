# MTU-P14: 준수 현황 대시보드 — Design 문서

> **문서 ID**: DESIGN-MTU-P14 | **복잡도**: MED | **작성일**: 2026-04-05
> **Plan 참조**: PLAN-MTU-P14 | **CSAP**: D-06, N-01

## 1. Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | CSAP 79항목 + N2SF 6영역 실시간 준수율 시각화 |
| 기술 | Fastify 5, 정적 체크리스트 기반 준수율 계산 |
| 보안 | RBAC (AUDITOR 이상만 접근) |
| 운영 | 감리 준비도 점수로 감리 대응 시점 판단 |

## 2. API 엔드포인트

| 메서드 | 경로 | FR | 설명 |
|--------|------|-----|------|
| GET | /compliance/csap | FR-P14.1 | CSAP 79항목 준수율 |
| GET | /compliance/n2sf | FR-P14.2 | N2SF 6영역 현황 |
| GET | /compliance/readiness | FR-P14.3 | 감리 준비도 점수 |
| GET | /compliance/metrics | FR-P14.4 | OpenTelemetry 메트릭 |

## 3. Design Anchor

- CSAP 79항목 = 정적 체크리스트 (D-01~D-12, 79개 세부항목)
- N2SF 6영역 = N-01~N-06 (네트워크, 데이터, 접근, 인증, 모니터링, 감사)
- 준수율 = (통과항목 / 전체항목) * 100
- 감리 준비도 = (CSAP 준수율 * 0.4) + (N2SF 준수율 * 0.3) + (문서 완성도 * 0.3)

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | 초안 작성 | PM Agent |
