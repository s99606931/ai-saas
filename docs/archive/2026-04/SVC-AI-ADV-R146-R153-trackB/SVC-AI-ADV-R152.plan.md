# SVC-AI-ADV-R152 — API 사용량 예측기

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer (트랙 B 3차)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 과거 API 호출 패턴 → 미래 사용량 예측 + 용량 계획 |
| 품질 | 이동평균 기반 예측, 피크 탐지, 용량 권고 |
| 보안 | 내부 메트릭, 외부 전송 없음 |
| 비용 | 순수 계산, LLM 없음 |

## Context Anchor

- **WHY**: API 사용량 급증으로 인한 서비스 장애 예방. 용량 계획 수립에 데이터 기반 근거 필요.
- **WHO**: 인프라 엔지니어, 용량 계획 담당자
- **RISK**: 예측 오류로 과잉/부족 용량 프로비저닝
- **SUCCESS**: 사용 이력 기록 → 패턴 분석 → 미래 예측 → 용량 권고 반환
- **SCOPE**: In — 이동평균 예측, 피크 탐지, 용량 권고. Out — 자동 스케일링.

## 요구사항

- **FR-R152.1**: `recordCall(apiId, timestamp, count)` — API 호출 기록
- **FR-R152.2**: `forecast(apiId, horizonHours)` — N시간 미래 사용량 예측
- **FR-R152.3**: `detectPeaks(apiId)` — 이상 피크 탐지
- **FR-R152.4**: `recommendCapacity(apiId)` — 용량 권고 반환
- **FR-R152.5**: `getAuditLog()` — 예측 이력 (CSAP D-06)
- **NFR-R152.1**: TypeScript strict 0 에러, 테스트 5개+

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
