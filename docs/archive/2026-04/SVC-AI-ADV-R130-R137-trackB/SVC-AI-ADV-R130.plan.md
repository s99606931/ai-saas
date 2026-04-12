# SVC-AI-ADV-R130 — AI 기반 공공서비스 수요 예측기

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: Implementer (트랙 B 2차)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 계절성/트렌드/이벤트 기반 공공 서비스 수요 예측 |
| 품질 | MAPE 15% 이내, 시계열 분해 기반 예측 |
| 보안 | 내부 수요 데이터만 사용, 외부 API 없음 |
| 비용 | 순수 계산 기반, LLM 없음 |

## Context Anchor

- **WHY**: 공공기관 서비스 수요 급증 시 서버 자원 부족으로 민원 처리 지연. 사전 수요 예측으로 자원 선제 확보 필요.
- **WHO**: 인프라 운영자, 서비스 기획자
- **RISK**: 예측 오류로 과잉/부족 자원 배분
- **SUCCESS**: 수요 데이터 입력 → 계절성/트렌드 분해 → 미래 수요 예측 반환
- **SCOPE**: In — 이동평균 트렌드, 계절성 지수, 이벤트 가중치. Out — 자동 스케일링 연동.

## 요구사항

- **FR-R130.1**: `recordDemand(serviceId, timestamp, value)` — 수요 시계열 기록
- **FR-R130.2**: `decompose(serviceId)` — 트렌드/계절성/잔차 분해
- **FR-R130.3**: `forecast(serviceId, horizonDays)` — N일 미래 수요 예측
- **FR-R130.4**: `addEvent(serviceId, date, multiplier)` — 이벤트 가중치 등록
- **FR-R130.5**: `getAuditLog()` — 예측 이력 (CSAP D-06)
- **NFR-R130.1**: TypeScript strict 0 에러, 테스트 6개+

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | Implementer |
