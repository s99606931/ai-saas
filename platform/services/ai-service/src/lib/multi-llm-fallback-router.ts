// Multi-LLM Fallback Router — FR-R79.1~R79.5
// Design Ref: SVC-AI-ADV-R79 DESIGN §모듈
// Plan SC: 가용성 99.9%, 선택 p95 < 5ms
// CSAP: D-06 감사, D-09 시크릿 관리 / N2SF: N-05

export type RoutingPolicy = 'priority' | 'cost' | 'latency';
export type CircuitState = 'closed' | 'open' | 'half_open';

export interface ProviderSpec {
  id: string;
  envKey: string; // e.g. LLM_OPENAI_API_KEY — 값은 저장 금지
  priority: number; // 1=highest
  costPer1kTokens: number;
  avgLatencyMs: number;
  enabled: boolean;
}

export interface CallResult {
  providerId: string;
  ok: boolean;
  latencyMs: number;
  tokens: number;
  error?: string;
}

export interface RouteDecision {
  chain: string[];
  policy: RoutingPolicy;
}

export interface ProviderAggregate {
  providerId: string;
  calls: number;
  successes: number;
  failures: number;
  costTotal: number;
  avgLatencyMs: number;
}

export type AuditAction =
  | 'REGISTER'
  | 'ROUTE'
  | 'CALL_OK'
  | 'CALL_FAIL'
  | 'FALLBACK'
  | 'CIRCUIT_OPEN'
  | 'CIRCUIT_HALF'
  | 'BLOCKED';

export interface AuditEvent {
  action: AuditAction;
  detail?: string;
  at: number;
}

interface CircuitData {
  state: CircuitState;
  failures: number;
  openedAt: number;
}

export interface RouterOptions {
  failureThreshold: number;
  cooldownMs: number;
}

const DEFAULT_OPTS: RouterOptions = {
  failureThreshold: 3,
  cooldownMs: 30_000,
};

export type LLMCaller = (providerId: string) => Promise<CallResult>;

export class MultiLLMFallbackRouter {
  private readonly providers = new Map<string, ProviderSpec>();
  private readonly circuits = new Map<string, CircuitData>();
  private readonly audit: AuditEvent[] = [];
  private readonly opts: RouterOptions;
  private readonly aggregates = new Map<
    string,
    {
      calls: number;
      successes: number;
      failures: number;
      costTotal: number;
      totalLatency: number;
    }
  >();
  private nowFn: () => number = Date.now;

  constructor(opts: Partial<RouterOptions> = {}) {
    this.opts = { ...DEFAULT_OPTS, ...opts };
  }

  /** 테스트용 시계 주입 */
  setClock(now: () => number): void {
    this.nowFn = now;
  }

  registerProvider(spec: ProviderSpec): void {
    if (!spec.id || !spec.envKey) {
      throw new Error('PROVIDER_INVALID');
    }
    // 시크릿 하드코딩 방지 — envKey 외 필드에 실제 키가 들어오지 않았는지 검사
    this.assertNoHardcodedSecret(spec);
    // envKey 패턴: UPPER_CASE 단어 + 언더스코어
    if (!/^[A-Z][A-Z0-9_]*$/.test(spec.envKey)) {
      this.logEvent({
        action: 'BLOCKED',
        detail: `invalid envKey ${spec.id}`,
        at: this.nowFn(),
      });
      throw new Error('PROVIDER_ENVKEY_INVALID');
    }
    if (spec.priority < 1) {
      throw new Error('PROVIDER_PRIORITY_INVALID');
    }
    this.providers.set(spec.id, { ...spec });
    this.circuits.set(spec.id, {
      state: 'closed',
      failures: 0,
      openedAt: 0,
    });
    this.aggregates.set(spec.id, {
      calls: 0,
      successes: 0,
      failures: 0,
      costTotal: 0,
      totalLatency: 0,
    });
    this.logEvent({
      action: 'REGISTER',
      detail: spec.id,
      at: this.nowFn(),
    });
  }

  /** env에서 API 키 값을 조회 (존재 확인만; 없으면 undefined) */
  resolveKey(providerId: string): string | undefined {
    const p = this.providers.get(providerId);
    if (!p) return undefined;
    return process.env[p.envKey];
  }

  decide(policy: RoutingPolicy): RouteDecision {
    const active = Array.from(this.providers.values()).filter((p) => p.enabled);
    const sorted = [...active].sort((a, b) => {
      const primaryA =
        policy === 'cost'
          ? a.costPer1kTokens
          : policy === 'latency'
          ? a.avgLatencyMs
          : a.priority;
      const primaryB =
        policy === 'cost'
          ? b.costPer1kTokens
          : policy === 'latency'
          ? b.avgLatencyMs
          : b.priority;
      if (primaryA !== primaryB) return primaryA - primaryB;
      return a.priority - b.priority;
    });
    const chain = sorted.map((p) => p.id);
    this.logEvent({
      action: 'ROUTE',
      detail: `${policy}/${chain.join(',')}`,
      at: this.nowFn(),
    });
    return { chain, policy };
  }

  async execute(
    policy: RoutingPolicy,
    caller: LLMCaller,
  ): Promise<CallResult> {
    const decision = this.decide(policy);
    let lastError: string | undefined;
    for (const providerId of decision.chain) {
      const circuit = this.circuits.get(providerId);
      if (!circuit) continue;
      const now = this.nowFn();
      if (circuit.state === 'open') {
        if (now - circuit.openedAt < this.opts.cooldownMs) {
          this.logEvent({
            action: 'FALLBACK',
            detail: `${providerId}/circuit_open`,
            at: now,
          });
          continue;
        }
        circuit.state = 'half_open';
        this.logEvent({
          action: 'CIRCUIT_HALF',
          detail: providerId,
          at: now,
        });
      }

      let result: CallResult;
      try {
        result = await caller(providerId);
      } catch (err) {
        result = {
          providerId,
          ok: false,
          latencyMs: 0,
          tokens: 0,
          error: err instanceof Error ? err.message : 'unknown',
        };
      }

      const agg = this.aggregates.get(providerId);
      if (agg) {
        agg.calls += 1;
        agg.totalLatency += result.latencyMs;
        const spec = this.providers.get(providerId);
        if (spec) {
          agg.costTotal +=
            (result.tokens / 1000) * spec.costPer1kTokens;
        }
      }

      if (result.ok) {
        if (agg) agg.successes += 1;
        circuit.state = 'closed';
        circuit.failures = 0;
        this.logEvent({
          action: 'CALL_OK',
          detail: `${providerId}/${result.latencyMs}ms`,
          at: this.nowFn(),
        });
        return result;
      }

      if (agg) agg.failures += 1;
      lastError = result.error;
      circuit.failures += 1;
      this.logEvent({
        action: 'CALL_FAIL',
        detail: `${providerId}/${result.error ?? ''}`,
        at: this.nowFn(),
      });
      if (circuit.failures >= this.opts.failureThreshold) {
        circuit.state = 'open';
        circuit.openedAt = this.nowFn();
        this.logEvent({
          action: 'CIRCUIT_OPEN',
          detail: providerId,
          at: circuit.openedAt,
        });
      }
    }

    return {
      providerId: 'none',
      ok: false,
      latencyMs: 0,
      tokens: 0,
      error: lastError ?? 'ALL_PROVIDERS_FAILED',
    };
  }

  aggregate(): ProviderAggregate[] {
    const out: ProviderAggregate[] = [];
    this.aggregates.forEach((agg, providerId) => {
      out.push({
        providerId,
        calls: agg.calls,
        successes: agg.successes,
        failures: agg.failures,
        costTotal: agg.costTotal,
        avgLatencyMs: agg.calls > 0 ? agg.totalLatency / agg.calls : 0,
      });
    });
    return out;
  }

  circuitOf(providerId: string): CircuitState {
    return this.circuits.get(providerId)?.state ?? 'closed';
  }

  getAuditLog(): AuditEvent[] {
    return this.audit.map((e) => ({ ...e }));
  }

  // ── 내부 ─────────────────────────────────────────────────────────────────
  private assertNoHardcodedSecret(spec: ProviderSpec): void {
    const suspects: string[] = [spec.id, spec.envKey];
    for (const s of suspects) {
      if (typeof s !== 'string') continue;
      if (/sk-[A-Za-z0-9]{20,}/.test(s)) {
        throw new Error('SECRET_HARDCODED');
      }
      if (/^[A-Fa-f0-9]{32,}$/.test(s)) {
        throw new Error('SECRET_HARDCODED');
      }
    }
  }

  private logEvent(ev: AuditEvent): void {
    this.audit.push(ev);
  }
}
