# MTU-N149 Cluster API 클러스터 수명주기 자동화 — Plan

> **문서 버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead
> **MTU ID**: MTU-N149 | **라운드**: 12 | **복잡도**: HIGH

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | Cluster API 기반 K8s 클러스터 프로비저닝/스케일링/업그레이드/해체 완전 자동화 |
| 기술 | CAPI v1beta1 + Docker Provider + Flux 연동 GitOps 수명주기 관리 |
| 보안 | CSAP-D11 가상화 보안 + N2SF N-03 격리 아키텍처 클러스터 단위 적용 |
| 감리 | 행안부 감리기준 인프라 자동화 추적성 + 변경 감사 로그 |

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | 수동 클러스터 관리는 휴먼 에러 유발, 감사 추적 불가, 복구 시간 초과 위험 |
| WHO | 플랫폼 엔지니어, SRE, 보안 운영자 |
| RISK | CAPI 컨트롤러 장애 시 클러스터 프로비저닝 불가, 업그레이드 중 서비스 중단 |
| SUCCESS | 클러스터 CRUD 100% 선언적 관리, 업그레이드 무중단, 감사 로그 완비 |
| SCOPE | CAPI 매니페스트 + 프로바이더 설정 + Flux 연동 + 수명주기 정책 |

## 기능 요구사항

| FR ID | 요구사항 | 검증 기준 |
|-------|---------|---------|
| FR-N149.1 | Cluster API 컨트롤러 + Docker Provider 설치 매니페스트 | clusterctl init 성공 확인 |
| FR-N149.2 | 워크로드 클러스터 선언적 프로비저닝 템플릿 | Cluster CR 적용 → 노드 Ready 상태 |
| FR-N149.3 | 클러스터 스케일링 정책 (MachineDeployment 오토스케일) | replica 변경 → 노드 자동 추가/제거 |
| FR-N149.4 | 클러스터 롤링 업그레이드 전략 | 버전 변경 → 무중단 롤링 업그레이드 |
| FR-N149.5 | 클러스터 해체 자동화 (Decommission Policy) | Cluster CR 삭제 → 리소스 완전 정리 |
| FR-N149.6 | Flux GitOps 연동 수명주기 관리 | Git 커밋 → 클러스터 변경 자동 적용 |
| FR-N149.7 | 감사 로그 및 이벤트 추적 | 모든 수명주기 이벤트 audit.jsonl 기록 |

## 비기능 요구사항

| NFR ID | 요구사항 | 기준 |
|--------|---------|------|
| NFR-N149.1 | 클러스터 프로비저닝 10분 이내 | 타이머 검증 |
| NFR-N149.2 | 업그레이드 중 서비스 가용성 99.9% | 헬스체크 연속 통과 |
| NFR-N149.3 | CSAP-D11 가상화 보안 준수 | 보안 설정 자동 적용 |

## 산출물

| 산출물 | 경로 |
|--------|------|
| Plan 문서 | `docs/archive/2026-04/MTU-N149-cluster-api-lifecycle/MTU-N149-cluster-api-lifecycle.plan.md` |
| Design 문서 | `docs/archive/2026-04/MTU-N149-cluster-api-lifecycle/MTU-N149-cluster-api-lifecycle.design.md` |
| CAPI 매니페스트 | `infra/cluster-api/` |
| 테스트 스크립트 | `tests/e2e/cluster-api/` |
| Report 문서 | `docs/archive/2026-04/MTU-N149-cluster-api-lifecycle/MTU-N149.report.md` |

## 추적성 매트릭스

| FR ID | CSAP | N2SF | 테스트 | 산출물 |
|-------|------|------|--------|--------|
| FR-N149.1 | D-11 | N-03 | TC-N149.1 | clusterctl 설치 매니페스트 |
| FR-N149.2 | D-11 | N-03 | TC-N149.2 | Cluster CR 템플릿 |
| FR-N149.3 | D-11 | N-01 | TC-N149.3 | MachineDeployment 정책 |
| FR-N149.4 | D-11 | N-06 | TC-N149.4 | 업그레이드 전략 |
| FR-N149.5 | D-11 | N-06 | TC-N149.5 | 해체 정책 |
| FR-N149.6 | D-12 | N-06 | TC-N149.6 | Flux 연동 설정 |
| FR-N149.7 | D-06 | N-06 | TC-N149.7 | 감사 로그 설정 |
