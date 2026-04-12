/**
 * 서비스 메시 AI 자동 설정
 * Design Ref: MTU-N469 §3
 * Plan SC: FR-SM.1~5
 */

export interface TrafficPattern {
  service: string;
  p50LatencyMs: number;
  p95LatencyMs: number;
  p99LatencyMs: number;
  errorRatePercent: number;
  requestsPerSec: number;
}

/**
 * 타임아웃·재시도 계산기 (FR-SM.2)
 */
export class TrafficPolicyAdvisor {
  /**
   * 타임아웃: p99의 1.5배 + 여유
   */
  recommendTimeout(pattern: TrafficPattern): number {
    const base = Math.ceil(pattern.p99LatencyMs * 1.5);
    return Math.max(base, 100);
  }

  /**
   * 재시도 횟수: 에러율 기반
   * <1%: 2회, 1-5%: 3회, >5%: 1회 (의미 없음)
   */
  recommendRetries(pattern: TrafficPattern): number {
    if (pattern.errorRatePercent < 1) return 2;
    if (pattern.errorRatePercent < 5) return 3;
    return 1;
  }

  /**
   * 회로 차단기 임계값 (FR-SM.3)
   */
  recommendCircuitBreaker(pattern: TrafficPattern): {
    maxConnections: number;
    consecutiveErrors: number;
    ejectionDurationSec: number;
  } {
    return {
      maxConnections: Math.max(100, Math.ceil(pattern.requestsPerSec * 2)),
      consecutiveErrors: pattern.errorRatePercent > 2 ? 3 : 5,
      ejectionDurationSec: 30,
    };
  }
}

/**
 * Istio VirtualService YAML 생성 (FR-SM.5)
 */
export class VirtualServiceGenerator {
  generate(input: {
    name: string;
    namespace: string;
    host: string;
    timeout: number;
    retries: number;
    mtlsEnabled: boolean;
  }): string {
    const lines: string[] = [];
    lines.push('apiVersion: networking.istio.io/v1beta1');
    lines.push('kind: VirtualService');
    lines.push('metadata:');
    lines.push(`  name: ${input.name}`);
    lines.push(`  namespace: ${input.namespace}`);
    lines.push('spec:');
    lines.push('  hosts:');
    lines.push(`    - ${input.host}`);
    lines.push('  http:');
    lines.push('    - route:');
    lines.push('        - destination:');
    lines.push(`            host: ${input.host}`);
    lines.push(`      timeout: ${input.timeout}ms`);
    lines.push('      retries:');
    lines.push(`        attempts: ${input.retries}`);
    lines.push(`        perTryTimeout: ${Math.floor(input.timeout / input.retries)}ms`);
    lines.push('        retryOn: 5xx,reset,connect-failure');

    if (input.mtlsEnabled) {
      lines.push('---');
      lines.push('apiVersion: security.istio.io/v1beta1');
      lines.push('kind: PeerAuthentication');
      lines.push('metadata:');
      lines.push(`  name: ${input.name}-mtls`);
      lines.push(`  namespace: ${input.namespace}`);
      lines.push('spec:');
      lines.push('  mtls:');
      lines.push('    mode: STRICT');
    }
    return lines.join('\n');
  }
}

/**
 * 트래픽 패턴 분석기 (FR-SM.1)
 */
export class TrafficAnalyzer {
  analyze(samples: TrafficPattern[]): {
    service: string;
    avgRps: number;
    peakRps: number;
    p99LatencyMs: number;
  }[] {
    const byService = new Map<string, TrafficPattern[]>();
    for (const s of samples) {
      const list = byService.get(s.service) ?? [];
      list.push(s);
      byService.set(s.service, list);
    }
    const result: Array<{
      service: string;
      avgRps: number;
      peakRps: number;
      p99LatencyMs: number;
    }> = [];
    for (const [service, list] of byService) {
      const avgRps = list.reduce((s, p) => s + p.requestsPerSec, 0) / list.length;
      const peakRps = Math.max(...list.map((p) => p.requestsPerSec));
      const p99 = Math.max(...list.map((p) => p.p99LatencyMs));
      result.push({ service, avgRps, peakRps, p99LatencyMs: p99 });
    }
    return result;
  }
}
