# SVC-AI-ADV-R128 — AI Embedding Drift Monitor

> 작성일: 2026-04-12 | 버전: 1.0.0 | 작성자: PM Lead
> 세션: #142 (R128~R132, 13차 PM 세션 o)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 임베딩 분포 변화(드리프트) 감지 — 베이스라인 대비 KL divergence + PSI(Population Stability Index) |
| 품질 | 결정적 bin 기반 히스토그램, 임계값 초과 시 severity 등급화, 윈도우 단위 비교 |
| 보안 | 원시 임베딩 외부 전송 금지, C/S 등급 차단, 감사 로그 append-only |
| 비용 | 오프라인 통계 계산, 외부 API 없음, in-memory |

## Context Anchor

- **WHY**: RAG/시맨틱 검색 품질은 임베딩 모델 교체·데이터 분포 이동 시 점진적으로 저하되므로, 모델 재학습/재인덱싱 판단을 위한 정량적 드리프트 시그널이 필요
- **WHO**: AI Platform 운영자, 데이터 과학자
- **RISK**: 드리프트 미탐지 → 검색 품질 저하 → 민원 답변 정확도 하락; 과민 탐지 → 불필요한 재학습 비용
- **SUCCESS**: 베이스라인 수집 → 윈도우 샘플 비교 → KL/PSI 계산 → 임계값 초과 시 alert emit 완결
- **SCOPE**: In — 벡터 집합 통계, bin 히스토그램, KL/PSI 계산, severity 분류, 감사. Out — 재학습 파이프라인 연동, 실시간 스트림 처리.

## 요구사항

- **FR-R128.1**: `setBaseline(vectors)` — 베이스라인 임베딩 집합 등록 (bin 기반 차원별 히스토그램 구축)
- **FR-R128.2**: `addSample(vectors)` — 관찰 윈도우 샘플 축적
- **FR-R128.3**: `computeDrift()` — baseline vs current 차원별 KL divergence 평균 + PSI 계산
- **FR-R128.4**: `classifySeverity(psi)` — PSI < 0.1 stable / 0.1~0.25 minor / >= 0.25 major 분류
- **FR-R128.5**: `onDriftAlert(listener)` — major 발생 시 알림 emit
- **FR-R128.6**: `getAuditLog()` — 전체 드리프트 이벤트 이력 (CSAP D-06)
- **NFR-R128.1**: TypeScript strict 0 에러, 테스트 10개+
- **NFR-R128.2**: 1000개 × 128차원 벡터 100ms 이내
- **CSAP D-06**: 감사 로그 append-only
- **N2SF N-05**: C/S 등급 벡터 입력 차단

## 추적성 매트릭스

| FR ID | 구현 파일 | 테스트 | CSAP |
|-------|-----------|--------|------|
| FR-R128.1~5 | ai-embedding-drift-monitor.ts | .test.ts | - |
| FR-R128.6 | getAuditLog() | test | D-06 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-12 | 최초 작성 | PM Lead |
