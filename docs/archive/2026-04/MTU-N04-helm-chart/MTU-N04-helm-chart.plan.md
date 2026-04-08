# MTU-N04: Helm Chart 패키징 -- Plan 문서

> **문서 ID**: PLAN-MTU-N04
> **버전**: 1.0.0
> **작성일**: 2026-04-08
> **작성자**: PM Lead (자율)
> **상태**: 승인

---

## Executive Summary

| 관점 | 내용 |
|------|------|
| 비즈니스 | 기존 raw k8s 매니페스트를 Helm Chart로 패키징하여 환경별 배포 자동화 |
| 기술 | 16개 서비스 + 3개 인프라 + 1개 포털 + 모니터링을 단일 Helm Chart로 통합 |
| 보안 | CSAP D-07 재해복구 (PDB, replicas), D-10 네트워크 격리, D-11 컨테이너 보안 유지 |
| 운영 | values-dev.yaml / values-stg.yaml / values-prod.yaml 환경 분리 |

---

## Context Anchor

| 항목 | 내용 |
|------|------|
| WHY | raw manifest는 환경별 설정 변경이 어렵고, 배포 재현성 부족 |
| WHO | 인프라 운영팀, DevOps 엔지니어, 감리인 |
| RISK | Helm 템플릿 오류 시 배포 실패 / values 누락 시 시크릿 노출 |
| SUCCESS | helm template으로 유효한 k8s 리소스 생성, 환경별 values 분리 완료 |
| SCOPE | 기존 k8s/ 디렉토리의 모든 리소스를 Helm Chart로 변환 |

---

## 기능 요구사항

| ID | 요구사항 | 우선순위 | 검증 기준 |
|----|---------|---------|----------|
| FR-N04.1 | Chart.yaml 메타데이터 (appVersion, dependencies) | 필수 | 유효한 Helm Chart 구조 |
| FR-N04.2 | 16개 마이크로서비스 Deployment + Service 템플릿화 | 필수 | helm template 성공 |
| FR-N04.3 | 인프라 서비스 (PostgreSQL, Redis, MinIO) 템플릿화 | 필수 | 조건부 활성화 가능 |
| FR-N04.4 | Portal Deployment + Service 템플릿화 | 필수 | NodePort 설정 가능 |
| FR-N04.5 | ConfigMap 템플릿화 (서비스 디스커버리) | 필수 | values에서 URL 오버라이드 가능 |
| FR-N04.6 | Secret 템플릿화 (existingSecret 지원) | 필수 | 외부 Secret 참조 가능 |
| FR-N04.7 | NetworkPolicy 템플릿화 | 필수 | 활성화/비활성화 가능 |
| FR-N04.8 | PDB (PodDisruptionBudget) 템플릿화 | 필수 | CSAP D-07 준수 |
| FR-N04.9 | DB 백업 CronJob 템플릿화 | 필수 | 스케줄 설정 가능 |
| FR-N04.10 | Prometheus AlertRules 템플릿화 | 선택 | 모니터링 활성화 시 포함 |
| FR-N04.11 | values.yaml 기본값 + values-dev/stg/prod.yaml | 필수 | 3환경 분리 |
| FR-N04.12 | NOTES.txt 배포 후 안내 | 필수 | 접속 정보 출력 |
| FR-N04.13 | _helpers.tpl 공통 함수 | 필수 | 이름/레이블/셀렉터 공통화 |

---

## 산출물 목록

| 산출물 | 경로 |
|--------|------|
| Chart.yaml | helm/saas-platform/Chart.yaml |
| values.yaml | helm/saas-platform/values.yaml |
| values-dev.yaml | helm/saas-platform/values-dev.yaml |
| values-stg.yaml | helm/saas-platform/values-stg.yaml |
| values-prod.yaml | helm/saas-platform/values-prod.yaml |
| _helpers.tpl | helm/saas-platform/templates/_helpers.tpl |
| NOTES.txt | helm/saas-platform/templates/NOTES.txt |
| namespace.yaml | helm/saas-platform/templates/namespace.yaml |
| configmap.yaml | helm/saas-platform/templates/configmap.yaml |
| secrets.yaml | helm/saas-platform/templates/secrets.yaml |
| network-policy.yaml | helm/saas-platform/templates/network-policy.yaml |
| microservices.yaml | helm/saas-platform/templates/microservices.yaml |
| api-gateway.yaml | helm/saas-platform/templates/api-gateway.yaml |
| portal.yaml | helm/saas-platform/templates/portal.yaml |
| infra-postgres.yaml | helm/saas-platform/templates/infra-postgres.yaml |
| infra-redis.yaml | helm/saas-platform/templates/infra-redis.yaml |
| infra-minio.yaml | helm/saas-platform/templates/infra-minio.yaml |
| db-backup-cronjob.yaml | helm/saas-platform/templates/db-backup-cronjob.yaml |
| pdb.yaml | helm/saas-platform/templates/pdb.yaml |
| prometheus-alerts.yaml | helm/saas-platform/templates/prometheus-alerts.yaml |

---

## 추적성 매트릭스

| FR ID | 원본 매니페스트 | Helm 템플릿 | CSAP |
|-------|---------------|-------------|------|
| FR-N04.1 | - | Chart.yaml | - |
| FR-N04.2 | k8s/services/microservices.yaml | templates/microservices.yaml | D-11 |
| FR-N04.3 | k8s/infra/*.yaml | templates/infra-*.yaml | D-09 |
| FR-N04.4 | k8s/portal/portal.yaml | templates/portal.yaml | D-11 |
| FR-N04.5 | k8s/config/configmap.yaml | templates/configmap.yaml | D-08 |
| FR-N04.6 | k8s/config/secrets*.yaml | templates/secrets.yaml | D-09 |
| FR-N04.7 | k8s/config/network-policy.yaml | templates/network-policy.yaml | D-10 |
| FR-N04.8 | microservices.yaml (PDB 부분) | templates/pdb.yaml | D-07 |
| FR-N04.9 | k8s/infra/db-backup-cronjob.yaml | templates/db-backup-cronjob.yaml | D-07 |
| FR-N04.10 | k8s/monitoring/prometheus-alerts.yaml | templates/prometheus-alerts.yaml | D-06 |
| FR-N04.11 | - | values*.yaml | - |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초기 작성 | PM Lead |
