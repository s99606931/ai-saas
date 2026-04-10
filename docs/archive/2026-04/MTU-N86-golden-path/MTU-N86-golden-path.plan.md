# MTU-N86: IDP Golden Path 템플릿 — Plan

> **MTU ID**: MTU-N86
> **Phase**: 6라운드 CI/CD·DevOps 고도화
> **작성일**: 2026-04-10

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 서비스 생성 표준화로 온보딩 시간 90% 단축, 보안 기본 적용 |
| 기술 | Golden Path 템플릿 + 셀프서비스 프로비저닝 CLI |
| 보안 | CSAP D-12 개발 보안 기본 내장, 보안 설정 자동 적용 |
| 운영 | 표준 서비스 구조 → 운영 일관성 보장 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 |
|----|---------|---------|
| FR-N86.1 | Node.js 서비스 Golden Path 템플릿 | HIGH |
| FR-N86.2 | Python 서비스 Golden Path 템플릿 | MED |
| FR-N86.3 | Helm Chart 템플릿 (보안 기본값) | HIGH |
| FR-N86.4 | CI/CD 파이프라인 템플릿 | HIGH |
| FR-N86.5 | 셀프서비스 프로비저닝 스크립트 | HIGH |
| FR-N86.6 | CSAP 보안 설정 자동 주입 | HIGH |

## 산출물 목록

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | Node.js 서비스 템플릿 | templates/golden-path/nodejs/ |
| 2 | Helm Chart 템플릿 | templates/golden-path/helm/ |
| 3 | CI/CD 템플릿 | templates/golden-path/cicd/ |
| 4 | 프로비저닝 스크립트 | scripts/create-service.sh |
| 5 | E2E 테스트 | tests/e2e/test-golden-path.sh |
