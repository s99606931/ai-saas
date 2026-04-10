# MTU-N218: Round 22 통합 점검 -- Grafana 통합 뷰 + 전체 검증

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0 | 2026-04-10 | 초안 작성 | PM Lead |

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Round 21-22(MTU-N200~N217) 18개 MTU 산출물 통합 검증 및 Grafana 통합 뷰 |
| 기술 | 통합 대시보드, 크로스 레퍼런스 Recording Rules, 상관관계 패널 |
| 품질 | 모든 구성 요소 상호 연동 검증, 드릴다운 링크 완전성 |
| 규제 | CSAP D-06 감사 로깅 통합, N2SF 모니터링 요건 충족 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 18개 개별 MTU 모니터링 산출물의 통합 검증 및 단일 뷰 제공 필요 |
| WHO | 인프라 운영팀, 보안 관제팀 |
| RISK | 개별 대시보드 간 불일치, 네비게이션 누락, Recording Rule 충돌 |
| SUCCESS | 통합 대시보드 1개 + 크로스 레퍼런스 Rules + 검증 스크립트 |
| SCOPE | MTU-N200~N217 산출물 통합 (신규 메트릭 추가 아님) |

## 기능 요구사항

| ID | 요구사항 | 검증 기준 |
|----|---------|----------|
| FR-N218.1 | Round 22 통합 Grafana 대시보드 | 18개 MTU 영역 패널 + 드릴다운 링크 |
| FR-N218.2 | 크로스 레퍼런스 Recording Rules | 영역 간 상관관계 메트릭 집계 |
| FR-N218.3 | 통합 알림 라우팅 규칙 | Round 22 알림 일괄 라우팅 설정 |
| FR-N218.4 | 통합 검증 스크립트 | YAML 문법 + Recording Rule 참조 무결성 검증 |

## 산출물

| # | 산출물 | 경로 |
|---|--------|------|
| 1 | 통합 대시보드 | `infra/monitoring/dashboards/round22-integration-dashboard.json` |
| 2 | 크로스 레퍼런스 Rules | `infra/monitoring/round22-cross-reference-rules.yaml` |
| 3 | 통합 알림 라우팅 | `infra/monitoring/round22-alert-routing.yaml` |
| 4 | 검증 스크립트 | `scripts/validate-round22-integration.sh` |

## 추적성 매트릭스

| FR ID | 산출물 | 테스트 | CSAP |
|-------|--------|--------|------|
| FR-N218.1 | 산출물 #1 | 대시보드 패널 검증 | D-06 |
| FR-N218.2 | 산출물 #2 | Rule 참조 무결성 | D-06 |
| FR-N218.3 | 산출물 #3 | 알림 라우팅 검증 | D-06 |
| FR-N218.4 | 산출물 #4 | 스크립트 실행 검증 | D-06 |
