# MTU-N100: Backstage IDP 서비스 카탈로그 + 템플릿 -- Plan

> **MTU ID**: MTU-N100
> **Phase**: CI/CD 8라운드
> **작성일**: 2026-04-10
> **복잡도**: HIGH

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 개발자 셀프서비스, 온보딩 시간 80% 단축 |
| 기술 | Backstage + Software Catalog + Software Templates |
| 보안 | RBAC 기반 카탈로그 접근, N2SF 등급별 템플릿 분리 |
| 운영 | TechDocs 자동 생성, API 문서 중앙화 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 42개 인프라 컴포넌트 관리 복잡도, 개발자 경험 향상 |
| WHO | 개발자, 플랫폼 팀, SRE |
| RISK | Backstage 커스터마이징 복잡도 |
| SUCCESS | 카탈로그 항목 20개+, 템플릿 5개+, TechDocs 연동 |
| SCOPE | Backstage Core, Software Catalog, Templates, TechDocs |

## 기능 요구사항

| ID | 요구사항 | 수용 기준 |
|----|---------|----------|
| FR-N100.1 | Backstage 설치 Helm values | values.yaml 포함 |
| FR-N100.2 | 서비스 카탈로그 엔티티 정의 | catalog-info.yaml 20개+ |
| FR-N100.3 | Software Template 정의 | 5개+ 템플릿 |
| FR-N100.4 | TechDocs 연동 설정 | mkdocs.yml + 빌더 설정 |
| FR-N100.5 | Kubernetes 플러그인 연동 | 실시간 Pod 상태 표시 |
| FR-N100.6 | E2E 테스트 작성 | 12건+ ALL PASS |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 초기 작성 | PM Agent |
