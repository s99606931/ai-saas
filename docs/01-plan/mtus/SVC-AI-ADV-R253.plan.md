# SVC-AI-ADV-R253 — AI 모델 공정성 평가기

> 작성일: 2026-04-13 | 버전: 1.0.0 | 작성자: PM Lead (자율 생성)

## Executive Summary

| 관점 | 내용 |
|------|------|
| 기능 | 보호 속성별 모델 예측 결과 편향 측정 + 공정성 지표 계산 + 완화 권고 |
| 품질 | Demographic Parity·Equal Opportunity·Disparate Impact 지표 |
| 보안 | C/S 등급 차단, CSAP D-06 감사 로그 |
| 비용 | 로컬 수학 계산, 외부 의존 없음 |

## Context Anchor

- **WHY**: 공공 AI 서비스 편향 → 차별 리스크 → N2SF AI 거버넌스 요건
- **WHO**: AI 거버넌스팀, 공정성 감사관, 모델 개발자
- **RISK**: 측정 오류 → 검증된 수학 공식 사용 (80% rule)
- **SUCCESS**: 예측 결과 등록 → 지표 계산 → 편향 판정 → 완화 권고
- **SCOPE**: In — 지표 계산·권고. Out — 모델 재학습

## 요구사항

- **FR-R253.1**: 모델 예측 결과 등록 (보호속성·예측·실제 라벨)
- **FR-R253.2**: Demographic Parity 계산 (그룹별 양성 예측률)
- **FR-R253.3**: Equal Opportunity 계산 (그룹별 TPR)
- **FR-R253.4**: Disparate Impact (80% rule) 판정
- **FR-R253.5**: 편향 수준 등급 분류 + 완화 권고 생성
- **FR-R253.6**: N2SF guard, CSAP D-06 감사 로그, getAuditLog()
- **NFR-R253.1**: TypeScript strict, 테스트 8개+

## 추적성 매트릭스

| FR ID | 구현 | 테스트 | CSAP |
|-------|------|--------|------|
| FR-R253.1~6 | model-fairness-evaluator.ts | .test.ts | D-06 |
