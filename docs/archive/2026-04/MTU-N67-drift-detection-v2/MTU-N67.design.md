# MTU-N67: Flux Drift Detection + ConfigMap/Secret 감사 설계

> **버전**: 1.0.0 | **작성일**: 2026-04-10 | **작성자**: infra-architect

---

## 1. Flux Drift Detection 설정

### Kustomization
```yaml
spec:
  force: false
  prune: true
  # 드리프트 감지: 5분 간격
  interval: 5m
  # 자동 복구 활성화
  retryInterval: 2m
```

### HelmRelease
```yaml
spec:
  driftDetection:
    mode: enabled    # warn | enabled
    ignore:
      - paths: ["/spec/replicas"]  # HPA 관리 필드 제외
        target:
          kind: Deployment
```

## 2. ConfigMap/Secret 감사 스크립트

- kubectl 기반 ConfigMap/Secret 변경 추적
- annotation 기반 최종 변경자/시간 기록
- Git 소스와 실제 클러스터 상태 비교
- 불일치 발견 시 감사 로그 기록 + Prometheus pushgateway 메트릭

## 3. 알림 규칙

- FluxDriftDetected: Kustomization/HelmRelease 드리프트 감지 시 warning
- ConfigMapDrifted: ConfigMap Git-Cluster 불일치 시 warning
- SecretDrifted: Secret 변경 감지 시 critical (보안)

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-10 | 최초 작성 | infra-architect |
