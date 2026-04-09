# Flux Drift Detection 운영 가이드

> **버전**: 1.0.0 | **작성일**: 2026-04-09
> **Design Ref**: MTU-N47 Design
> **Plan SC**: FR-N47.1 ~ FR-N47.6

---

## 개요

Flux Drift Detection은 클러스터의 실제 상태와 Git 소스의 desired 상태를 비교하여
불일치(drift)를 탐지하고 자동으로 교정하는 GitOps 핵심 기능입니다.

---

## 환경별 정책

| 환경 | 모드 | 동작 | Reconcile 주기 |
|------|------|------|---------------|
| Production | `enabled` | 탐지 + 자동 교정 | 5분 |
| Staging | `warn` | 탐지 + 이벤트만 | 10분 |
| Development | `disabled` | 비활성 | 30분 |

---

## 설정 파일 위치

```
infra/flux/drift-detection/
  helmrelease-patch-prod.yaml   # Production drift detection
  helmrelease-patch-stg.yaml    # Staging drift detection
  helmrelease-patch-dev.yaml    # Development (disabled)
  alerting-rules.yaml           # Prometheus 알림 규칙
```

---

## Drift 발생 시 대응 절차

### 자동 교정 (Production)

1. Flux가 drift 감지
2. 자동으로 Git 소스의 상태로 복원
3. Kubernetes Event 기록
4. Prometheus 메트릭 업데이트
5. AlertManager를 통해 알림 발송

### 수동 교정 (Staging)

1. Flux가 drift 감지
2. Kubernetes Event + 로그 기록
3. 알림 발송
4. 운영자가 원인 확인
5. Git에 정상 상태 커밋 또는 수동 복원

---

## 알림 규칙

| 알림 | 심각도 | 조건 |
|------|--------|------|
| FluxDriftDetected | warning | Reconcile Ready=False 2분 이상 |
| FluxDriftRemediated | info | 프로덕션 자동 교정 수행 |
| FluxReconcileFailure | critical | Reconcile 실패 10분 이상 |
| FluxSuspended | warning | 리소스 일시 중단 1시간 이상 |
| FluxControllerDown | critical | 컨트롤러 다운 5분 이상 |
| FluxSourceNotReady | warning | Git 소스 동기화 실패 5분 이상 |

---

## 모니터링

### Grafana 대시보드

- 대시보드 이름: "Flux 드리프트 탐지"
- UID: `flux-drift-detection`
- 패널: 현재 드리프트 수, 자동 교정 횟수, 리소스별 상태, 이벤트 추이

### CLI 확인

```bash
# 전체 HelmRelease 상태
flux get helmreleases -A

# Kustomization 상태
flux get kustomizations -A

# 이벤트 확인
kubectl get events -n flux-system --field-selector reason=DriftDetected

# 특정 리소스 reconcile 강제 실행
flux reconcile helmrelease <name> -n <namespace>
```

---

## Drift 무시 설정

특정 필드는 의도적으로 drift를 허용합니다:

| 무시 경로 | 이유 |
|-----------|------|
| `/spec/replicas` | HPA 자동 스케일링에 의한 변경 |
| `/spec/minReplicas` | HPA 설정 변경 |
| `/spec/maxReplicas` | HPA 설정 변경 |

---

## CSAP 준수

| CSAP 항목 | 구현 |
|-----------|------|
| D-06 침해사고 관리 | 모든 drift 이벤트 감사 추적 + 알림 |
| D-08 접근 통제 | 프로덕션 수동 변경 자동 차단(교정) |
| D-12 시스템 개발 보안 | GitOps 워크플로우 강제로 변경 통제 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-09 | 최초 작성 | PM Lead |
