# Design: MTU-N31 Kyverno Enforce 전환

| 항목 | 내용 |
|------|------|
| MTU ID | MTU-N31 |
| 작성일 | 2026-04-08 |
| 복잡도 | MED |
| 버전 | 1.0 |

## Design Anchor

- **Plan 참조**: docs/01-plan/mtus/MTU-N31-kyverno-enforce.plan.md
- **PRD 참조**: docs/00-pm/MTU-N31-kyverno-enforce.prd.md
- **기존 정책**: infra/kyverno/verify-image-signature.yaml (Audit 모드)

## 아키텍처 옵션 분석

### Option A: Kyverno Standalone (최소 설치)

- Kyverno Helm Chart 기본 설치
- 단일 replica, 최소 리소스
- 장점: WSL2 리소스 절약
- 단점: HA 미지원

### Option B: Kyverno HA (표준 설치)

- 3 replica, admission/background/reports controller 분리
- 장점: 프로덕션 수준
- 단점: WSL2에서 과도한 리소스

### Option C: Pragmatic Balance (선택)

- Kyverno Standalone + failurePolicy=Ignore
- 단일 replica + 최소 리소스 제한
- webhookTimeoutSeconds=10 (빠른 실패 회복)
- 장점: WSL2 적합 + Enforce 모드 검증 가능
- 단점: HA 미지원 (개발/테스트 환경에서 허용)

## 선택: Option C (Pragmatic Balance)

WSL2 개발 환경에 적합한 최소 설치로 Enforce 모드 기능 검증에 집중.

## 상세 설계

### 1. Kyverno 설치 (Helm)

```yaml
# infra/kyverno/values.yaml
admissionController:
  replicas: 1
  resources:
    requests:
      cpu: 100m
      memory: 128Mi
    limits:
      cpu: 500m
      memory: 384Mi
backgroundController:
  enabled: true
  resources:
    requests:
      cpu: 50m
      memory: 64Mi
    limits:
      cpu: 200m
      memory: 128Mi
reportsController:
  enabled: false  # WSL2 리소스 절약
cleanupController:
  enabled: false  # WSL2 리소스 절약
config:
  webhooks:
    - failurePolicy: Ignore  # webhook 장애 시 Pod 생성 허용
```

### 2. 정책 전환 전략 (Gradual Rollout)

1단계: Kyverno 설치 + Audit 모드 정책 적용
2단계: PolicyReport 확인 (기존 Pod 위반 여부)
3단계: Enforce 모드 전환
4단계: 미서명 이미지 차단 검증

### 3. verify-image-signature Enforce 정책

기존 YAML에서 `validationFailureAction: Audit` → `Enforce`로 변경.
Kyverno 특성: 기존 위반 리소스는 업데이트 시에도 통과 (기존 서비스 보호).

### 4. 검증 시나리오

- 미서명 이미지(nginx:latest) 배포 시도 → 거부 확인
- 서명된 이미지(localhost:8080/public-saas/*) 배포 → 허용 확인
- 기존 Pod 재시작/스케일 → 정상 동작 확인

## Session Guide

1. Helm repo 추가 + values.yaml 작성
2. helm install kyverno kyverno/kyverno
3. Audit 모드 정책 apply → PolicyReport 확인
4. Enforce 전환 → 검증
5. 가이드 문서 작성
