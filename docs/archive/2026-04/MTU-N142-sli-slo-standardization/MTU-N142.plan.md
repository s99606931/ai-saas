# MTU-N142: SLI/SLO 정의 표준화 — Plan

> **문서 ID**: MTU-N142.plan
> **버전**: 1.0.0 | **작성일**: 2026-04-10
> **작성자**: PM Lead (claude-opus-4-6)

---

## Executive Summary (4관점)

| 관점 | 내용 |
|------|------|
| 비즈니스 | 전체 마이크로서비스 SLI/SLO 표준화로 공공기관 SaaS 가용성 보장 및 CSAP D-06 준수 자동화 |
| 기술 | Sloth CRD 기반 서비스별 SLI 정의, 지연시간/가용성/처리량 3대 SLI 표준, 에러 버짓 정책 |
| 운영 | 13개 서비스 전수 SLO 커버리지, 누락 서비스 8개 신규 추가, 티어별 목표값 표준화 |
| 규제 | CSAP D-06 침해사고 관리(SLO 위반 자동 탐지), N2SF 서비스 가용성 요건 충족 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 현재 5개 서비스만 SLO 정의 → 8개 핵심 서비스 누락. 일관된 SLI 메트릭 체계 부재 |
| WHO | SRE 팀, 플랫폼 운영자, CSAP 감사인 |
| RISK | SLO 미정의 서비스의 장애 감지 지연, 감리 시 가용성 증빙 불가 |
| SUCCESS | 13개 서비스 전수 Sloth CRD 정의, 3대 SLI(가용성/지연/처리량) 표준 적용 |
| SCOPE | Sloth CRD 8개 신규 + 기존 5개 표준화 리팩토링, SLI 표준 문서 |

## 기능 요구사항

| FR ID | 요구사항 | 우선순위 | 검증 기준 |
|-------|---------|---------|----------|
| FR-N142.1 | SLI 표준 정의서 (3대 SLI 유형 + 티어별 목표) | P0 | 문서 존재 + 전 서비스 커버리지 |
| FR-N142.2 | 누락 8개 서비스 Sloth CRD 생성 | P0 | YAML 파일 생성 + 문법 검증 |
| FR-N142.3 | 기존 5개 서비스 SLO 표준 정합성 검증 | P1 | 표준 대비 차이 분석 완료 |
| FR-N142.4 | 통합 SLI/SLO 카탈로그 (전체 메트릭 일람표) | P1 | 13개 서비스 x N개 SLO 매트릭스 |
| FR-N142.5 | SLO 거버넌스 정책 (목표 변경 절차, 리뷰 주기) | P2 | 정책 문서 존재 |

## 서비스 티어 분류 및 SLO 목표

| 티어 | 서비스 | 가용성 | P95 지연 | 비고 |
|------|--------|--------|---------|------|
| Critical | api-gateway | 99.9% | < 500ms | 모든 트래픽 진입점 |
| Critical | auth-service | 99.95% | < 300ms | CSAP D-08 접근 통제 |
| Critical | audit-service | 99.99% | < 200ms | CSAP D-06 감사 로그 |
| High | tenant-service | 99.9% | < 500ms | 멀티테넌시 핵심 |
| High | user-service | 99.9% | < 500ms | 사용자 관리 |
| High | subscription-service | 99.9% | < 500ms | 구독 관리 |
| High | ai-gateway | 99.5% | < 2000ms | 외부 LLM 의존 |
| Standard | menu-service | 99.5% | < 500ms | UI 메뉴 구성 |
| Standard | catalog-service | 99.5% | < 500ms | SaaS 카탈로그 |
| Standard | billing-service | 99.5% | < 1000ms | 과금 처리 |
| Standard | crm-service | 99.5% | < 1000ms | 고객 관계 관리 |
| Standard | notification-service | 99.5% | < 1000ms | 알림 발송 |
| Standard | file-service | 99.5% | < 2000ms | 파일 업/다운로드 |

## 산출물 목록

| 산출물 | 경로 | 형식 |
|--------|------|------|
| SLI 표준 정의서 | `infra/slo/README.md` | Markdown |
| user-service SLO | `infra/slo/user-service-slo.yaml` | Sloth CRD |
| menu-service SLO | `infra/slo/menu-service-slo.yaml` | Sloth CRD |
| catalog-service SLO | `infra/slo/catalog-service-slo.yaml` | Sloth CRD |
| subscription-service SLO | `infra/slo/subscription-service-slo.yaml` | Sloth CRD |
| billing-service SLO | `infra/slo/billing-service-slo.yaml` | Sloth CRD |
| crm-service SLO | `infra/slo/crm-service-slo.yaml` | Sloth CRD |
| notification-service SLO | `infra/slo/notification-service-slo.yaml` | Sloth CRD |
| file-service SLO | `infra/slo/file-service-slo.yaml` | Sloth CRD |
| 통합 SLI 카탈로그 | `infra/slo/sli-catalog.yaml` | YAML |

## 추적성 매트릭스

| FR ID | 산출물 | CSAP | 비고 |
|-------|--------|------|------|
| FR-N142.1 | infra/slo/README.md | D-06 | SLI 표준 정의 |
| FR-N142.2 | infra/slo/*-slo.yaml (8개) | D-06 | Sloth CRD |
| FR-N142.3 | 기존 5개 CRD 검증 결과 | D-06 | Plan 내 분석 |
| FR-N142.4 | infra/slo/sli-catalog.yaml | D-06 | 전체 카탈로그 |
| FR-N142.5 | infra/slo/README.md §거버넌스 | D-06 | 변경 관리 정책 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
