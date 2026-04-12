# Design: MTU-N40 Flagger 카나리 배포 전략

> **버전**: 1.0.0 | **작성일**: 2026-04-09

---

## Design Anchor

| 항목 | 값 |
|------|---|
| 도구 | Flagger v1.37+ (Flux 프로젝트) |
| 메시/인그레스 | Traefik (k3s 기본 IngressController) |
| 메트릭 | Prometheus (기존 모니터링 스택) |
| 배포 전략 | Progressive Canary (10→30→60→100%) |
| 롤백 기준 | 성공률 <99% 또는 p99 지연 >500ms |

---

## S3. 상세 설계

### S3.1 Flagger 설치

```bash
helm repo add flagger https://flagger.app
helm install flagger flagger/flagger \
  --namespace flagger-system --create-namespace \
  -f infra/flagger/values.yaml
```

### S3.2 Canary 리소스 흐름

```
Deployment 변경 감지 → Canary Pod 생성 → 10% 트래픽 전환
→ 메트릭 분석 (30초) → 30% → 분석 → 60% → 분석 → 100%
→ 성공: Primary 교체, Canary 제거
→ 실패: 즉시 롤백, Alert 발생
```

### S3.3 Traefik + Flagger 연동

k3s의 기본 IngressController인 Traefik과 Flagger를 연동합니다.
Flagger는 TraefikService를 사용하여 트래픽 분할을 수행합니다.
