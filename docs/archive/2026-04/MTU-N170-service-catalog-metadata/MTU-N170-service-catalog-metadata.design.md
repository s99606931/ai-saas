# MTU-N170: 서비스 카탈로그 메타데이터 표준화 — Design

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: PM Lead  
> **Plan 참조**: MTU-N170-service-catalog-metadata.plan.md

---

## 1. 아키텍처 옵션 분석

| 옵션 | 설명 | 장점 | 단점 |
|------|------|------|------|
| A. Backstage 내장 검증만 | Backstage Catalog 기본 검증 | 추가 개발 없음 | 커스텀 필드 검증 불가 |
| B. 외부 검증 도구 | JSON Schema + CI 파이프라인 | 유연한 검증 | 도구 의존성 |
| **C. Pragmatic Balance** | YAML 스키마 + CI + CronJob 드리프트 감지 | 완전 자동화 | 없음 |

**선택: 옵션 C**

## 2. 컴포넌트 구조

```
infra/backstage/
├── catalog/
│   ├── all-components.yaml          (기존 — 강화)
│   └── metadata-schema.yaml         (FR-N170.1)
├── templates/
│   ├── microservice-template.yaml   (기존 — 강화)
│   └── catalog-info-standard.yaml   (FR-N170.2)
├── validation/
│   ├── validate-metadata.sh         (FR-N170.3)
│   └── annotation-sync-policy.yaml  (FR-N170.4)
└── monitoring/
    ├── drift-detector.yaml          (FR-N170.5)
    └── dependency-graph-config.yaml (FR-N170.6)
```

## 3. 표준 메타데이터 스키마 (FR-N170.1)

### 필수 필드 (12개)

| 필드 | 유형 | 설명 |
|------|------|------|
| metadata.name | string | 서비스 식별자 (kebab-case) |
| metadata.description | string | 서비스 설명 (한국어) |
| metadata.tags | array | 기술 스택, 분류 태그 |
| metadata.annotations.backstage.io/kubernetes-id | string | K8s 식별자 |
| spec.type | enum | service, library, website |
| spec.lifecycle | enum | development, production, deprecated |
| spec.owner | string | 소유 팀 (team-{name} 형식) |
| spec.system | string | 소속 시스템 |
| saas.local/data-classification | enum | O, C, S (N2SF 등급) |
| saas.local/csap-controls | array | 관련 CSAP 통제항목 |
| saas.local/tier | enum | critical, standard, background |
| saas.local/slo-target | string | SLO 목표 (예: 99.9%) |

### 선택 필드 (8개)

| 필드 | 유형 | 설명 |
|------|------|------|
| spec.providesApis | array | 제공 API 목록 |
| spec.consumesApis | array | 소비 API 목록 |
| spec.dependsOn | array | 의존 리소스 |
| saas.local/on-call | string | 당직 담당자/팀 |
| saas.local/runbook-url | string | 운영 매뉴얼 URL |
| saas.local/monitoring-dashboard | string | Grafana 대시보드 UID |
| saas.local/cost-center | string | 비용 센터 코드 |
| saas.local/last-audit-date | string | 최종 감사일 |

## 4. 서비스 catalog-info.yaml 표준 템플릿 (FR-N170.2)

모든 서비스는 이 템플릿을 기반으로 catalog-info.yaml 작성.

## 5. 메타데이터 검증 CI (FR-N170.3)

- YAML 구문 검증 (yamllint)
- 필수 필드 존재 확인 (jq/yq)
- 값 형식 검증 (정규식)
- Gitea CI 파이프라인 통합

## 6. K8s 어노테이션 동기화 (FR-N170.4)

Backstage catalog-info.yaml의 어노테이션과 K8s Deployment 어노테이션 일치 정책.

## 7. 드리프트 감지 (FR-N170.5)

CronJob으로 Backstage 카탈로그와 K8s 실제 배포 상태 비교.

## 8. 의존성 그래프 (FR-N170.6)

providesApis/consumesApis 기반 서비스 토폴로지 자동 생성.

## 9. CSAP/N2SF 매핑

| CSAP | 항목 | 구현 |
|------|------|------|
| D-08 | 접근통제 | 소유권 기반 서비스 관리 |
| D-12 | 개발 보안 | CI 검증으로 메타데이터 품질 보장 |
| D-06 | 감사 | 메타데이터 변경 이력 추적 |

## Design Anchor

- 기존 all-components.yaml 형식 유지, 표준 어노테이션 추가
- 기존 microservice-template.yaml 형식 유지, 표준 필드 추가

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | PM Lead |
