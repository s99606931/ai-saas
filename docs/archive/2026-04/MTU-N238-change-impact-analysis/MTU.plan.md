# MTU-N238: 릴리스 변경 영향 분석 자동화 -- Plan

> **버전**: 1.0 | **작성일**: 2026-04-10

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 릴리스 전 변경 위험도 자동 평가로 안전한 배포 의사결정 지원 |
| 기술 | Git diff 분석 + 서비스 의존성 그래프 + 위험도 점수 산출 |
| 보안 | 보안 관련 파일 변경 감지 시 자동 에스컬레이션 |
| 운영 | PR/릴리스에 변경 영향 보고서 자동 첨부 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-CIA.1 | Git diff 기반 변경 파일 분석 + 영향 범위 판정 | P0 |
| FR-CIA.2 | 서비스 의존성 그래프 기반 파급 효과 분석 | P0 |
| FR-CIA.3 | 변경 위험도 점수 (Low/Medium/High/Critical) | P0 |
| FR-CIA.4 | 보안 관련 파일 변경 자동 감지 | P1 |
| FR-CIA.5 | 영향 분석 보고서 자동 생성 | P1 |

## 산출물

| 산출물 | 경로 |
|--------|------|
| 분석 스크립트 | scripts/change-impact-analysis.sh (기존 보강) |
| 위험도 규칙 | infra/cicd/change-impact-rules.yaml |
| 테스트 | scripts/test-change-impact-analysis.sh |
