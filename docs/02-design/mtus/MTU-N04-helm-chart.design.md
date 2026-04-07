# MTU-N04: Helm Chart 패키징 -- Design 문서

> **문서 ID**: DESIGN-MTU-N04
> **버전**: 1.0.0
> **작성일**: 2026-04-08
> **Plan 참조**: PLAN-MTU-N04
> **상태**: 승인

---

## Executive Summary

| 관점 | 설계 결정 |
|------|---------|
| 비즈니스 | 단일 umbrella chart로 전체 플랫폼을 환경별로 배포 |
| 기술 | Helm 3 + Go 템플릿, range로 서비스 반복 생성 |
| 보안 | existingSecret 지원, 시크릿 미포함 기본값 |
| 운영 | values 오버라이드만으로 dev/stg/prod 전환 가능 |

---

## 아키텍처 선택: Pragmatic Balance

### 선택: 단일 Chart (모노리스 Chart)

- 모든 서비스를 하나의 Chart에 포함
- values.yaml에서 서비스별 enabled/disabled 토글
- range 루프로 15개 서비스 반복 생성 (코드 중복 최소화)

### 미채택 대안

1. **Subchart 분리**: 서비스별 subchart -- 과도한 복잡도, 현 규모에 불필요
2. **Helmfile 조합**: 여러 chart를 helmfile로 관리 -- 추가 도구 의존성

---

## 서비스 정의 구조

values.yaml에서 각 서비스를 맵으로 정의:

```yaml
services:
  auth-service:
    enabled: true
    port: 3001
    replicas: 1
    image:
      repository: saas/auth-service
      tag: dev
    resources:
      limits: { memory: 256Mi, cpu: 500m }
      requests: { memory: 128Mi, cpu: 100m }
    readinessProbe:
      path: /ready
    livenessProbe:
      path: /health
    env: {}
```

템플릿에서 `range .Values.services`로 반복:

```yaml
{{- range $name, $svc := .Values.services }}
{{- if $svc.enabled }}
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ $name }}
...
{{- end }}
{{- end }}
```

---

## 시크릿 처리 (CSAP D-09)

```yaml
secrets:
  create: false              # true: Chart가 Secret 생성, false: 기존 Secret 참조
  existingSecretName: saas-secrets   # 외부 Secret 이름
```

- 운영 환경: `secrets.create: false` + Sealed Secrets / Vault 연동
- 개발 환경: `secrets.create: true` + values-dev.yaml에 base64 값

---

## CSAP 보안 요건 반영

| CSAP | 적용 방법 |
|------|---------|
| D-07 | PDB (audit-service minAvailable: 2), replicas 설정 가능 |
| D-09 | Secret은 existingSecret 기본, Chart 내 하드코딩 없음 |
| D-10 | NetworkPolicy 기본 활성화 (networkPolicy.enabled: true) |
| D-11 | securityContext 기본 적용 (non-root, read-only FS, drop ALL) |
| D-06 | Prometheus AlertRules 포함 (monitoring.enabled: true) |
| D-07 | DB 백업 CronJob 포함 (backup.enabled: true) |

---

## 환경별 values 분리

| 파일 | 주요 차이점 |
|------|-----------|
| values.yaml | 기본값 (개발용 기본 설정) |
| values-dev.yaml | replicas=1, 리소스 최소, 디버그 로깅 |
| values-stg.yaml | replicas=1~2, 중간 리소스, info 로깅 |
| values-prod.yaml | replicas=2~3, 최대 리소스, warn 로깅, PDB 활성화 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-08 | 초기 작성 | PM Lead |
