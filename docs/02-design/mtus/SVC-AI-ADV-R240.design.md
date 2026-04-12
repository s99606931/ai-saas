# SVC-AI-ADV-R240 Design: AI기반 멀티클라우드 네트워크 최적화

## 구현 파일
`platform/services/ai-service/src/lib/multicloud-network-optimizer.ts`

## 핵심 설계
- `CloudEndpoint`: provider (AWS/AZURE/GCP/ON_PREMISE), currentBandwidthMbps, maxBandwidthMbps
- `NetworkMetric`: latencyMs, bandwidthUsedMbps, packetLossRate
- 최근 5개 메트릭 평균 계산
- packetLoss > 0.02 → REROUTE (NEUTRAL 비용)
- bandwidthUtil > 0.85 → INCREASE_BANDWIDTH (최대 2배, max 제한)
- latency > 200ms + 비온프레미스 → ENABLE_CDN
- 감사 로그: `endpoint.register`, `network.optimize`
