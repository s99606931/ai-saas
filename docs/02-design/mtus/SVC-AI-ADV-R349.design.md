# SVC-AI-ADV-R349 Design: Predictive Workload Distributor

## 알고리즘
1. predicted = SMA(last windowSize samples)
2. 저부하 노드부터 greedy 할당 (unit 단위 누적)
3. 남은 부하 = overflow

## 타입
```typescript
interface WorkloadNode { id; capacity; load; }
interface Assignment { nodeId; addedLoad; }
interface DistributionPlan { predicted; assignments[]; overflow; }
```

## CSAP/N2SF
- C/S 차단 (N2SF N-05)
- getAuditLog() 전수 기록
