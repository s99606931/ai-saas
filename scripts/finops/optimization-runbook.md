# FinOps 비용 최적화 Runbook

> **Design Ref**: MTU-N59 Section 3.1
> **Plan SC**: FR-N59.5

---

## 1. 리소스 우측 크기 조정 (Right-Sizing)

### 1.1 VPA 추천값 확인

```bash
# VPA 추천값 조회
kubectl get vpa -n saas -o yaml | grep -A 5 "recommendation"

# 특정 서비스 추천값
kubectl get vpa auth-service-vpa -n saas -o jsonpath='{.status.recommendation.containerRecommendations}'
```

### 1.2 조정 절차

1. VPA 추천값과 현재 설정 비교
2. requests를 추천값의 80%로 설정 (버퍼 20%)
3. limits를 추천값의 200%로 설정 (버스트 허용)
4. 스테이징 환경 적용 후 1주 관찰
5. 프로덕션 적용

---

## 2. 유휴 리소스 정리

### 2.1 유휴 서비스 탐지

```bash
# 0 트래픽 서비스 탐지
./scripts/finops/idle-resource-detect.sh saas

# KEDA scale-to-zero 적용
# infra/keda/scaled-objects/ 에 ScaledObject 추가
# minReplicaCount: 0, idleReplicaCount: 0
```

### 2.2 미사용 리소스 정리

```bash
# 완료된 Job 정리
kubectl delete jobs --field-selector status.successful=1 -n saas

# Evicted Pod 정리
kubectl get pods -n saas | grep Evicted | awk '{print $1}' | xargs kubectl delete pod -n saas

# 미사용 PVC 탐지
kubectl get pvc -n saas --no-headers | while read name _; do
  if ! kubectl get pods -n saas -o json | grep -q "$name"; then
    echo "미사용 PVC: $name"
  fi
done
```

---

## 3. 오버프로비저닝 해소

### 3.1 탐지

```bash
./scripts/finops/overprovisioning-check.sh 20 saas
# CPU/메모리 사용률 20% 미만 서비스 목록 출력
```

### 3.2 조정 기준

| 현재 사용률 | 권고 조치 |
|-----------|----------|
| < 10% | requests 50% 감소 |
| 10~20% | requests 30% 감소 |
| 20~50% | 적정 (유지) |
| 50~80% | 적정 (모니터링) |
| > 80% | requests 증가 검토 |

---

## 4. 비용 절감 체크리스트

- [ ] VPA 추천값 기반 right-sizing 적용
- [ ] KEDA scale-to-zero 대상 서비스 확인
- [ ] 미사용 PVC 정리
- [ ] 완료된 Job/Evicted Pod 정리
- [ ] Dev/Stg 환경 리소스 축소 (Prod의 50%)
- [ ] 주간 비용 리포트 검토
- [ ] Grafana 비용 대시보드 이상 징후 확인

---

## 5. 자동화 일정

| 작업 | 주기 | 스크립트 |
|------|------|---------|
| 리소스 분석 | 주간 | `resource-analysis.sh` |
| 오버프로비저닝 탐지 | 주간 | `overprovisioning-check.sh` |
| 유휴 리소스 탐지 | 일간 | `idle-resource-detect.sh` |
| 비용 리포트 | 주간 | `weekly-cost-report.sh` |
