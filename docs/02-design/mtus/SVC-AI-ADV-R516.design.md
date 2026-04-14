# SVC-AI-ADV-R516 Design — api-gateway-security-enhancer-v2.ts

Plan Ref: SVC-AI-ADV-R516.plan.md

```ts
export type AnomalyType = 'RATE_ABUSE' | 'ERROR_STORM' | 'IP_SWEEP' | 'NORMAL';
export type RiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';
export type GatewayPolicy = 'BLOCK' | 'THROTTLE' | 'ALLOW';
export interface ApiRequest {
  readonly clientId: string;
  readonly endpoint: string;
  readonly requestsPerMin: number;
  readonly errorRate: number;  // 0~1
  readonly uniqueIPs: number;
}
export interface SecurityAnalysis {
  readonly clientId: string;
  readonly anomalies: readonly AnomalyType[];
  readonly riskLevel: RiskLevel;
  readonly policy: GatewayPolicy;
}
```

anomalies: requestsPerMin>1000→RATE_ABUSE, errorRate>0.3→ERROR_STORM, uniqueIPs>500→IP_SWEEP
riskLevel: RATE_ABUSE||IP_SWEEP in anomalies→HIGH, ERROR_STORM→MEDIUM, else LOW
policy: HIGH→BLOCK, MEDIUM→THROTTLE, LOW→ALLOW
