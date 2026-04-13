# SVC-AI-ADV R295~R303 Plan — 트랙 A 9차

> **요구사항 범위**: R295 ~ R303 (9개 MTU)
> **작성일**: 2026-04-13
> **작성자**: ai-impl-a
> **버전**: 1.0.0

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| WHY | 공공기관 SaaS 플랫폼의 AI 고급 서비스 모듈 9차 구현 |
| WHO | AI 서비스 개발팀, 보안팀, HR 관리팀 |
| RISK | N2SF C/S 등급 데이터 AI 전송 차단 위반, PII 마스킹 누락 |
| SUCCESS | 9개 MTU 구현 + 70개 테스트 통과 + TypeScript 0 오류 |
| SCOPE | R295~R303 — KPI 자동화·마이그레이션·데이터 분류·컴플라이언스·카탈로그·역량·보안테스트·위협인텔·데이터수명주기 |

---

## Context Anchor

- **WHY**: SaaS 플랫폼 AI 기반 분석 기능 9차 확장
- **WHO**: 플랫폼 운영자, 보안 담당자, HR 관리자
- **RISK**: N2SF C/S 등급 데이터 노출, CSAP D-06 감사 누락
- **SUCCESS**: 모든 테스트 통과, TypeScript strict 모드 0 오류
- **SCOPE**: 9개 AI 분석 모듈

---

## 요구사항 목록

| ID | MTU | 설명 |
|----|-----|------|
| FR-R295 | public-service-kpi-automator | 공공 서비스 KPI 자동화 |
| FR-R296 | cloud-migration-planner-ai | 클라우드 마이그레이션 계획 |
| FR-R297 | auto-data-classifier-v2 | 데이터 자동 분류 v2 |
| FR-R298 | security-compliance-auto-corrector | 보안 컴플라이언스 자동 교정 |
| FR-R299 | service-catalog-recommender-ai | 서비스 카탈로그 추천 |
| FR-R300 | employee-competency-analyzer-ai | 직원 역량 자동 분석 |
| FR-R301 | security-test-generator-ai | 보안 테스트 자동 생성 |
| FR-R302 | realtime-threat-intelligence-ai | 실시간 위협 인텔리전스 |
| FR-R303 | public-data-lifecycle-manager-ai | 공공 데이터 수명 주기 관리 |

---

## 성공 기준

| ID | 기준 |
|----|------|
| SC-R295 | UP/DOWN 방향 KPI, 가중 점수, RISING/FALLING 트렌드 |
| SC-R296 | REHOST/REPLATFORM/REFACTOR 전략, C/S 등급 온프레미스 강제 |
| SC-R297 | SSN(C)/EMAIL(S)/패턴 없음(O) 자동 분류, 최고 등급 우선 |
| SC-R298 | autoFixable→FIXED, 수동→PENDING_MANUAL, 심각도별 감점 |
| SC-R299 | 조직유형+카테고리+인기도+평점 기반 topN 추천 |
| SC-R300 | gap≥2→HIGH, 역량 초과→strengths, PII 마스킹 |
| SC-R301 | SQL_INJECTION/XSS/AUTH_BYPASS/IDOR/SENSITIVE_EXPOSURE 생성 |
| SC-R302 | PRIVILEGE_ESC→CRITICAL, BRUTE_FORCE/PORT_SCANNING 패턴, IP 마스킹 |
| SC-R303 | 90일 미접근→ARCHIVE, 보존기간 초과→DELETE, legalHold→LEGAL_HOLD |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-13 | 초기 작성 | ai-impl-a |
