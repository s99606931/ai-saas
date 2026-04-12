// Design Ref: MTU-N469 §서비스 메시 AI
// Plan SC: FR-SM.1~5

export interface TrafficSample {
  service: string;
  p50LatencyMs: number;
  p99LatencyMs: number;
  errorRate: number;
  rps: number;
}

export interface MeshPolicy {
  service: string;
  timeoutMs: number;
  retries: number;
  circuitBreakerThreshold: number;
  mtlsMode: 'STRICT' | 'PERMISSIVE';
}

export class ServiceMeshAi {
  /** FR-SM.1 트래픽 패턴 분석 */
  classifyTraffic(samples: TrafficSample[]): Array<{ service: string; risk: 'low' | 'medium' | 'high' }> {
    return samples.map((s) => {
      let risk: 'low' | 'medium' | 'high' = 'low';
      if (s.errorRate > 0.05 || s.p99LatencyMs > 1500) risk = 'high';
      else if (s.errorRate > 0.01 || s.p99LatencyMs > 500) risk = 'medium';
      return { service: s.service, risk };
    });
  }

  /** FR-SM.2 타임아웃/재시도 */
  computeTimeoutAndRetries(sample: TrafficSample): { timeoutMs: number; retries: number } {
    const timeoutMs = Math.max(Math.ceil(sample.p99LatencyMs * 2), 300);
    const retries = sample.errorRate < 0.01 ? 3 : sample.errorRate < 0.05 ? 2 : 1;
    return { timeoutMs, retries };
  }

  /** FR-SM.3 회로 차단기 임계값 */
  computeCircuitBreaker(sample: TrafficSample): number {
    return Math.max(Math.round(sample.errorRate * 100 + 5), 10);
  }

  /** FR-SM.4 mTLS 정책 */
  determineMtls(sensitiveServices: Set<string>, service: string): 'STRICT' | 'PERMISSIVE' {
    return sensitiveServices.has(service) ? 'STRICT' : 'PERMISSIVE';
  }

  /** FR-SM.5 VirtualService YAML */
  generateVirtualService(policy: MeshPolicy): string {
    return [
      'apiVersion: networking.istio.io/v1beta1',
      'kind: VirtualService',
      'metadata:',
      `  name: ${policy.service}-vs`,
      'spec:',
      `  hosts: ["${policy.service}"]`,
      '  http:',
      '    - route:',
      `        - destination: { host: ${policy.service} }`,
      `      timeout: ${policy.timeoutMs}ms`,
      `      retries: { attempts: ${policy.retries} }`,
    ].join('\n');
  }

  buildPolicy(sample: TrafficSample, sensitiveServices: Set<string>): MeshPolicy {
    const { timeoutMs, retries } = this.computeTimeoutAndRetries(sample);
    return {
      service: sample.service,
      timeoutMs,
      retries,
      circuitBreakerThreshold: this.computeCircuitBreaker(sample),
      mtlsMode: this.determineMtls(sensitiveServices, sample.service),
    };
  }
}

export const serviceMeshAi = new ServiceMeshAi();
