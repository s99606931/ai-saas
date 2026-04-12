// Design Ref: MTU-N469 §service-mesh
// Plan SC: FR-SM.1 ~ FR-SM.5
//
// 서비스 메시 자동 구성 — 트래픽 패턴 기반 timeout/retry/회로차단 + mTLS 정책 +
// Istio VirtualService YAML 생성.

export interface TrafficSample {
  service: string;
  latencyP50: number;
  latencyP95: number;
  latencyP99: number;
  errorRate: number;
  rps: number;
}

export interface ResiliencyPolicy {
  service: string;
  timeoutMs: number;
  retries: number;
  perTryTimeoutMs: number;
  circuitBreaker: {
    consecutiveErrors: number;
    intervalSec: number;
    baseEjectionTimeSec: number;
    maxEjectionPercent: number;
  };
  mtls: 'STRICT' | 'PERMISSIVE';
}

// FR-SM.1: 트래픽 패턴 분석
export function analyzeTraffic(sample: TrafficSample): {
  isHighLatency: boolean;
  isErrorProne: boolean;
  isHighTraffic: boolean;
} {
  return {
    isHighLatency: sample.latencyP95 > 1000,
    isErrorProne: sample.errorRate > 0.01,
    isHighTraffic: sample.rps > 100,
  };
}

// FR-SM.2: 타임아웃/재시도 자동 계산
// 원칙: timeout = p99 * 2, perTryTimeout = p95 * 1.5, retries = 오류율 기반.
export function computeTimeouts(sample: TrafficSample): {
  timeoutMs: number;
  retries: number;
  perTryTimeoutMs: number;
} {
  const timeoutMs = Math.max(500, Math.round(sample.latencyP99 * 2));
  const perTryTimeoutMs = Math.max(200, Math.round(sample.latencyP95 * 1.5));
  const retries = sample.errorRate > 0.05 ? 1 : sample.errorRate > 0.01 ? 2 : 3;
  return { timeoutMs, retries, perTryTimeoutMs };
}

// FR-SM.3: 회로 차단기 임계값
export function computeCircuitBreaker(sample: TrafficSample): ResiliencyPolicy['circuitBreaker'] {
  const consecutiveErrors = sample.errorRate > 0.05 ? 3 : 5;
  const intervalSec = sample.rps > 100 ? 10 : 30;
  return {
    consecutiveErrors,
    intervalSec,
    baseEjectionTimeSec: 30,
    maxEjectionPercent: 50,
  };
}

// FR-SM.4: mTLS 정책 (민감 서비스는 STRICT 강제)
export function computeMtls(service: string, sensitiveServices: Set<string>): 'STRICT' | 'PERMISSIVE' {
  return sensitiveServices.has(service) ? 'STRICT' : 'STRICT'; // 기본도 STRICT (CSAP D-09)
}

// 전체 정책 빌드
export function buildResiliencyPolicy(
  sample: TrafficSample,
  sensitiveServices: Set<string> = new Set(),
): ResiliencyPolicy {
  const t = computeTimeouts(sample);
  return {
    service: sample.service,
    timeoutMs: t.timeoutMs,
    retries: t.retries,
    perTryTimeoutMs: t.perTryTimeoutMs,
    circuitBreaker: computeCircuitBreaker(sample),
    mtls: computeMtls(sample.service, sensitiveServices),
  };
}

// FR-SM.5: Istio VirtualService YAML 생성 (간단화)
export function renderVirtualServiceYaml(policy: ResiliencyPolicy): string {
  const lines: string[] = [];
  lines.push('apiVersion: networking.istio.io/v1');
  lines.push('kind: VirtualService');
  lines.push(`metadata:`);
  lines.push(`  name: ${policy.service}`);
  lines.push(`  namespace: public-saas`);
  lines.push(`spec:`);
  lines.push(`  hosts:`);
  lines.push(`    - ${policy.service}`);
  lines.push(`  http:`);
  lines.push(`    - route:`);
  lines.push(`        - destination:`);
  lines.push(`            host: ${policy.service}`);
  lines.push(`      timeout: ${policy.timeoutMs}ms`);
  lines.push(`      retries:`);
  lines.push(`        attempts: ${policy.retries}`);
  lines.push(`        perTryTimeout: ${policy.perTryTimeoutMs}ms`);
  lines.push(`        retryOn: 5xx,reset,connect-failure`);
  return lines.join('\n');
}

export function renderDestinationRuleYaml(policy: ResiliencyPolicy): string {
  const lines: string[] = [];
  lines.push('apiVersion: networking.istio.io/v1');
  lines.push('kind: DestinationRule');
  lines.push(`metadata:`);
  lines.push(`  name: ${policy.service}`);
  lines.push(`spec:`);
  lines.push(`  host: ${policy.service}`);
  lines.push(`  trafficPolicy:`);
  lines.push(`    tls:`);
  lines.push(`      mode: ISTIO_MUTUAL`);
  lines.push(`    outlierDetection:`);
  lines.push(`      consecutive5xxErrors: ${policy.circuitBreaker.consecutiveErrors}`);
  lines.push(`      interval: ${policy.circuitBreaker.intervalSec}s`);
  lines.push(`      baseEjectionTime: ${policy.circuitBreaker.baseEjectionTimeSec}s`);
  lines.push(`      maxEjectionPercent: ${policy.circuitBreaker.maxEjectionPercent}`);
  return lines.join('\n');
}
