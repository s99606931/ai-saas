# SVC-AI-ADV-R380 Design: AI기반 지능형 네트워크 보안 감시

## 핵심 알고리즘

### 이상 탐지
- `trafficMbps > thresholdMbps` → ThreatEvent 생성
- threat level: trafficMbps > threshold * 2 → 'critical', else 'warning'
- 활성 위협: resolved=false인 이벤트

## 클래스 설계

```typescript
class IntelligentNetworkSecurityMonitor {
  registerSegment(id, name, thresholdMbps): void
  recordTraffic(segmentId, trafficMbps, sourceIp, grade): ThreatEvent | null
  getActiveThreats(): ThreatEvent[]
  resolveTheat(threatId): void
  getAuditLog(): AuditEntry[]
}
```

## N2SF / CSAP 적용
- C/S 등급: recordTraffic 차단
- 감사 로그: segment.register, traffic.record, threat.detected, threat.resolve
