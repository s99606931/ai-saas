# Plan: MTU-N33 부하 테스트

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N33 |
| 작성일 | 2026-04-08 |
| 복잡도 | MED |
| 버전 | 1.0 |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | API 성능 기준 실측으로 SLA 수립 기초 자료 확보 |
| 기술 | k6 또는 autocannon 기반 HTTP 부하 테스트 |
| 보안 | CSAP NFR 비기능 요건 (가용성, 성능) 검증 증적 |
| 운영 | WSL2 환경 실측 → 프로덕션 용량 계획 기준점 |

## Context Anchor

- **WHY**: API Gateway 성능 기준 미측정 상태, CSAP NFR 검증 필요
- **WHO**: 성능 엔지니어, 운영자
- **RISK**: 과도한 부하 시 WSL2 클러스터 불안정
- **SUCCESS**: TPS, P95/P99, 에러율 측정 + 보고서
- **SCOPE**: API Gateway /health + 서비스 라우팅 부하 테스트

## 기능 요구사항

| FR ID | 요구사항 | 검증 방법 | CSAP 매핑 |
|-------|---------|---------|----------|
| FR-N33.1 | 부하 테스트 도구 설치 | which autocannon or k6 | D-12 |
| FR-N33.2 | 부하 테스트 스크립트 작성 | 파일 존재 확인 | D-12 |
| FR-N33.3 | 부하 테스트 실행 (10 VUs, 30초) | 실행 결과 출력 | NFR |
| FR-N33.4 | 결과 분석 (TPS, P95/P99, 에러율) | 보고서 수치 확인 | NFR |
| FR-N33.5 | 부하 테스트 보고서 + 가이드 | 문서 존재 확인 | D-12 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| 부하 테스트 스크립트 | scripts/load-test.js | JavaScript |
| 테스트 설정 | scripts/load-test-config.json | JSON |
| 결과 보고서 | docs/07-infra/load-test-report.md | Markdown |
| 가이드 | docs/07-infra/load-testing-guide.md | Markdown |

## 실행 순서

1. autocannon 설치 (npm/npx 사용, 설치 불필요)
2. 부하 테스트 스크립트 작성 (Health, 서비스 라우팅)
3. 가벼운 부하 실행 (10 connections, 30초)
4. 결과 수집 및 분석
5. 보고서 + 가이드 문서 작성
