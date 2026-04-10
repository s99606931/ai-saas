# 토폴로지 인식 라우팅 운영 런북

> **Design Ref**: MTU-N159 Section 3  
> **Plan SC**: FR-N159.7  
> **최종 수정**: 2026-04-10  

---

## 1. 개요

이 런북은 토폴로지 인식 라우팅(TAR) 운영 중 발생할 수 있는 장애 상황에 대한 대응 절차를 정의합니다.

### 대시보드 접근
- Grafana: `토폴로지 인식 라우팅 대시보드` (UID: topology-routing-N159)
- Prometheus: `topology_routing:same_zone_ratio` 메트릭 확인

---

## 2. 장애 대응 절차

### 2.1 크로스존 트래픽 비율 높음 {#cross-zone-high}

**알림**: `TopologyRoutingCrossZoneHigh`  
**심각도**: Warning  
**임계값**: 크로스존 비율 > 30% (5분 지속)

**원인 분석**:
1. 존별 엔드포인트 불균형
2. TAR 힌트 미할당
3. 노드 토폴로지 레이블 누락

**대응 절차**:
```bash
# 1. 노드 토폴로지 레이블 확인
kubectl get nodes -o custom-columns=\
'NAME:.metadata.name,ZONE:.metadata.labels.topology\.kubernetes\.io/zone'

# 2. EndpointSlice 힌트 확인
kubectl get endpointslice -n public-saas -o yaml | grep -A5 hints

# 3. 존별 엔드포인트 분포 확인
kubectl get endpoints -n public-saas -o wide

# 4. 레이블 누락 시 재설정
bash scripts/setup-topology-labels.sh --verify
bash scripts/setup-topology-labels.sh
```

### 2.2 존 내 엔드포인트 부족 {#endpoint-shortage}

**알림**: `TopologyRoutingEndpointShortage`  
**심각도**: Warning  
**임계값**: 존 내 엔드포인트 < 2개 (2분 지속)

**대응 절차**:
```bash
# 1. 해당 존의 파드 상태 확인
kubectl get pods -n public-saas -o wide --field-selector spec.nodeName=<node>

# 2. 파드 스케줄링 상태 확인
kubectl describe pod <pod-name> -n public-saas | grep -A10 Events

# 3. Pod Topology Spread Constraints 확인
kubectl get deployment <name> -n public-saas -o yaml | grep -A10 topologySpreadConstraints

# 4. 파드 수 조정 (필요 시)
kubectl scale deployment <name> -n public-saas --replicas=<존수*최소2>
```

### 2.3 존 내 엔드포인트 제로 {#endpoint-zero}

**알림**: `TopologyRoutingEndpointZero`  
**심각도**: Critical  
**임계값**: 존 내 엔드포인트 == 0 (1분 지속)

**즉시 대응**:
```bash
# 1. 크로스존 페일오버 자동 활성화 확인
kubectl get configmap topology-failover-policy -n public-saas -o yaml

# 2. 해당 존 노드 상태 확인
kubectl get nodes -l topology.kubernetes.io/zone=<zone> -o wide

# 3. 노드 NotReady 시 드레인
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# 4. 파드 재스케줄링 대기 (자동)
kubectl get pods -n public-saas -w
```

**사후 조치**:
- 장애 원인 분석 및 포스트모템 작성
- 존별 최소 레플리카 수 검토
- PodDisruptionBudget 설정 확인

### 2.4 엔드포인트 불균형 {#endpoint-imbalance}

**알림**: `TopologyRoutingEndpointImbalance`  
**심각도**: Warning  
**임계값**: 균형도 > 0.3 (10분 지속)

**대응 절차**:
```bash
# 1. 존별 파드 분포 확인
kubectl get pods -n public-saas -o wide | awk '{print $7}' | sort | uniq -c

# 2. TopologySpreadConstraints 적용
cat <<EOF | kubectl apply -f -
apiVersion: apps/v1
kind: Deployment
metadata:
  name: <deployment>
  namespace: public-saas
spec:
  template:
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: <app-label>
EOF

# 3. 기존 파드 롤링 재시작 (분포 재조정)
kubectl rollout restart deployment/<deployment> -n public-saas
```

### 2.5 페일오버 빈발 {#frequent-failover}

**알림**: `TopologyRoutingFrequentFailover`  
**심각도**: Warning  
**임계값**: 1시간 내 5회 이상

**대응 절차**:
1. 특정 존의 반복 장애인지 확인
2. 해당 존 노드의 리소스 상태 점검 (CPU, 메모리, 디스크)
3. 네트워크 연결성 확인
4. 필요 시 해당 존 노드 교체 또는 레플리카 증설

---

## 3. 정기 점검 항목

| 주기 | 항목 | 담당 |
|------|------|------|
| 일간 | 크로스존 트래픽 비율 확인 | SRE |
| 주간 | 존별 엔드포인트 균형도 점검 | SRE |
| 월간 | TAR 정책 효과 분석 (비용 절감 보고서) | FinOps |
| 분기 | 토폴로지 아키텍처 검토 | 인프라 팀 |

---

## 4. 유용한 명령어 모음

```bash
# TAR 활성화된 서비스 목록
kubectl get svc -n public-saas -o json | \
  jq '.items[] | select(.metadata.annotations["service.kubernetes.io/topology-mode"]=="Auto") | .metadata.name'

# 존별 파드 분포 요약
kubectl get pods -n public-saas -o json | \
  jq -r '.items[] | [.spec.nodeName, .metadata.name] | @tsv' | \
  sort | column -t

# TAR 검증 스크립트 실행
bash scripts/verify-topology-routing.sh
```
