# SVC-AI-ADV-R412 Design — AI기반 지능형 이벤트 스트림 처리 최적화

## §R412 설계 결정
- 파티션 단위 processedPerMin / consumerLag 측정
- consumerLag > lagThreshold → CONGESTED, 스케일아웃 권고
- consumerLag <= lagThreshold → HEALTHY
- 처리량 최적화: 파티션 수 증가 또는 소비자 그룹 병렬화 권고
- 감사 로그: stream.analyze 액션

## 인터페이스
```typescript
interface StreamPartition { partitionId, topicId, processedPerMin, consumerLag, lagThreshold }
interface StreamOptimizationReport { topicId, totalPartitions, congestedPartitions, overallStatus, recommendations }
```
