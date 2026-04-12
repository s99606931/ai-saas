# 9장: 트러블슈팅 가이드

> 공공기관 SaaS 프레임워크 신규 직원 온보딩 가이드북
> 버전: 1.1.0 | 작성일: 2026-04-12 | 대상: 전체 역할

---

## 이 장에서 다루는 내용

개발, 배포, 운영 중에 발생하는 문제를 신속하게 진단하고 해결하는 방법을 제공합니다.
초급자도 스스로 문제를 해결할 수 있도록 증상 기반의 단계별 해결 절차를 안내합니다.

---

## 목차

| 문서 | 주제 | 대상 | 예상 학습 시간 |
|------|------|------|--------------|
| [01-common-errors.md](01-common-errors.md) | 자주 발생하는 오류와 해결법 (pnpm, k8s, CI/CD, 인증, 모니터링) | 전체 | 60분 |
| [02-debugging-guide.md](02-debugging-guide.md) | 5-Why 방법론 + kubectl 심화 + k9s + stern + Grafana 연결 | 개발자, 인프라 | 60분 |
| [03-performance-guide.md](03-performance-guide.md) | CPU/메모리 프로파일링, Prisma 쿼리, Redis, 스케일링, PromQL | 개발자, 인프라 | 50분 |

---

## 트러블슈팅 기본 원칙

**5-Why 접근법**: 증상에 즉시 대응하지 말고, 근본 원인을 찾을 때까지 "왜?"를 5번 반복하십시오.

**로그 우선**: 추측하기 전에 반드시 로그를 먼저 확인하십시오.

```bash
# 가장 먼저 확인할 것들
kubectl logs <pod-name> -n saas-platform --tail=100
kubectl describe pod <pod-name> -n saas-platform
kubectl get events -n saas-platform --sort-by='.lastTimestamp'
```

**재현 우선**: 문제를 재현할 수 있어야 해결했다고 할 수 있습니다.

---

## 빠른 진단 체크리스트

문제 발생 시 다음 순서로 확인하십시오.

```
[ ] 1. 로그에 에러 메시지 있는지 확인
[ ] 2. 최근 배포 또는 코드 변경이 있었는지 확인
[ ] 3. 관련 서비스의 Pod 상태 확인 (Running/CrashLoop/Pending)
[ ] 4. 리소스 부족 여부 확인 (CPU, 메모리, 디스크)
[ ] 5. 환경 변수 및 시크릿 올바르게 설정되었는지 확인
[ ] 6. 의존 서비스 (DB, Redis, 외부 API) 정상 여부 확인
[ ] 7. 네트워크 연결 및 방화벽 규칙 확인
```

---

## 긴급 상황 대응

### 프로덕션 장애 발생 시

```bash
# 1. 현재 상태 즉시 확인
kubectl get pods -n saas-platform
kubectl get nodes

# 2. 장애 범위 파악
kubectl get events -n saas-platform --sort-by='.lastTimestamp' | tail -30

# 3. 최근 배포 확인
helm history <release-name> -n saas-platform

# 4. 필요 시 즉시 롤백
helm rollback <release-name> -n saas-platform
```

### 에스컬레이션 기준

| 상황 | 조치 |
|------|------|
| Pod 1개 CrashLoop | 담당자 자체 해결 |
| 핵심 서비스 전체 다운 | 팀 리드 즉시 연락 |
| 데이터 손실 가능성 | 보안팀 + 팀 리드 즉시 연락 |
| 보안 침해 의심 | 보안팀 최우선 연락, 서비스 격리 |

---

## 관련 문서

- [5장 모니터링 가이드](../05-monitoring.md) — Prometheus, Grafana, Loki 활용
- [5장 분산 추적](../05-monitoring/tracing/01-tempo-otel.md) — Tempo로 병목 찾기
- [6장 CI/CD 파이프라인](../06-cicd.md) — Q-Gate 실패 해결

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | 초안 작성 | Implementer (Sonnet) |
