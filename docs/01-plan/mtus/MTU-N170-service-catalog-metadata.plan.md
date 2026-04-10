# MTU-N170: 서비스 카탈로그 메타데이터 표준화 — Plan

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Phase**: Round 15 — 모니터링 고도화  
> **의존**: MTU-N100 (Backstage IDP 기본 설정)

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 서비스 메타데이터 일관성으로 개발자 경험 향상 및 운영 가시성 확보 |
| 기술 | Backstage catalog-info.yaml 표준 스키마 + Kubernetes 어노테이션 동기화 |
| 운영 | 서비스 소유권, 의존성, SLO 메타데이터 중앙 관리 |
| 규제 | CSAP D-08 접근통제 (서비스 소유권 기반), N2SF 데이터 분류 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 서비스 메타데이터 불일치 → 소유권 불명확 → 장애 대응 지연 → 감리 지적 |
| WHO | 개발팀, SRE 팀, 보안 담당자, 감리원 |
| RISK | 메타데이터 드리프트, Backstage-K8s 동기화 실패 |
| SUCCESS | 서비스 메타데이터 커버리지 100%, 드리프트 감지율 95% |
| SCOPE | catalog-info.yaml 표준, 메타데이터 검증기, 드리프트 탐지 |

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 기준 |
|----|---------|---------|----------|
| FR-N170.1 | 표준 메타데이터 스키마 정의 | HIGH | 필수 필드 12개, 선택 필드 8개 |
| FR-N170.2 | 서비스별 catalog-info.yaml 템플릿 | HIGH | 모든 서비스 표준 형식 적용 |
| FR-N170.3 | 메타데이터 검증 CI 파이프라인 | HIGH | PR 시 자동 검증, 실패 차단 |
| FR-N170.4 | K8s 어노테이션 동기화 정책 | MED | Backstage ↔ K8s 어노테이션 일치 |
| FR-N170.5 | 메타데이터 드리프트 감지 | MED | 6시간 주기, 불일치 알림 |
| FR-N170.6 | 서비스 의존성 그래프 자동 생성 | MED | providesApis/consumesApis 기반 |

## 비기능 요구사항

| ID | 요구사항 | 기준 |
|----|---------|------|
| NFR-N170.1 | 메타데이터 검증 시간 | 5초 이내 |
| NFR-N170.2 | 드리프트 감지 주기 | 6시간 |
| NFR-N170.3 | 카탈로그 갱신 지연 | 5분 이내 |

## 추적성 매트릭스

| FR ID | Design | 구현 파일 | 테스트 | CSAP |
|-------|--------|----------|--------|------|
| FR-N170.1 | §3 | metadata-schema.yaml | 스키마 검증 | D-08 |
| FR-N170.2 | §4 | catalog-info-template.yaml | 템플릿 적용 | D-08 |
| FR-N170.3 | §5 | validate-metadata.sh | CI 통합 | D-12 |
| FR-N170.4 | §6 | annotation-sync-policy.yaml | 동기화 확인 | D-08 |
| FR-N170.5 | §7 | drift-detector.yaml | 드리프트 탐지 | D-06 |
| FR-N170.6 | §8 | dependency-graph-config.yaml | 그래프 생성 | D-08 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
