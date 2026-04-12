/**
 * 플랫폼 품질·완성도 레이어 (MTU-N501~N510)
 * Design Ref: R11 품질 완성도
 * Plan SC: FR-N501.* ~ FR-N510.*
 *
 * - N501: 레이턴시 버짓 추적
 * - N502: 에러 버짓 계산기
 * - N503: 트래픽 패턴 대시보드 데이터
 * - N504: 캐시 적중률 분석
 * - N505: 재시도 큐 관리
 * - N506: 지연 작업 스케줄러
 * - N507: 피처 토글 런타임
 * - N508: API 버전 호환성 체크
 * - N509: 배포 카나리 제어
 * - N510: 플랫폼 체크섬 검증
 */

// ============ MTU-N501: Latency Budget Tracker ============

export class LatencyBudgetTracker {
  private samples: number[] = [];

  constructor(private budgetMs: number) {}

  record(latencyMs: number): void {
    this.samples.push(latencyMs);
  }

  budgetRemainingPercent(): number {
    if (this.samples.length === 0) return 100;
    const withinBudget = this.samples.filter((s) => s <= this.budgetMs).length;
    return (withinBudget / this.samples.length) * 100;
  }

  violations(): number {
    return this.samples.filter((s) => s > this.budgetMs).length;
  }
}

// ============ MTU-N502: Error Budget Calculator ============

export class ErrorBudgetCalculator {
  constructor(
    private sloPercent: number, // 예: 99.9
    private windowTotalRequests: number,
  ) {}

  /**
   * 허용 에러 수 = (1 - SLO/100) * total
   */
  allowedErrors(): number {
    return Math.floor(((100 - this.sloPercent) / 100) * this.windowTotalRequests);
  }

  remaining(currentErrors: number): {
    allowed: number;
    consumed: number;
    remaining: number;
    burnedPercent: number;
  } {
    const allowed = this.allowedErrors();
    const remaining = Math.max(0, allowed - currentErrors);
    const burnedPercent = allowed > 0 ? (currentErrors / allowed) * 100 : 0;
    return {
      allowed,
      consumed: currentErrors,
      remaining,
      burnedPercent: Math.min(100, burnedPercent),
    };
  }
}

// ============ MTU-N503: Traffic Pattern Dashboard ============

export interface TrafficSample {
  endpoint: string;
  method: string;
  statusCode: number;
  latencyMs: number;
  timestamp: string;
}

export class TrafficPatternAnalyzer {
  private samples: TrafficSample[] = [];

  add(sample: TrafficSample): void {
    this.samples.push({ ...sample });
  }

  byEndpoint(): Map<string, { count: number; p95LatencyMs: number; errorRate: number }> {
    const result = new Map<string, { count: number; p95LatencyMs: number; errorRate: number }>();
    const grouped = new Map<string, TrafficSample[]>();
    for (const s of this.samples) {
      const list = grouped.get(s.endpoint) ?? [];
      list.push(s);
      grouped.set(s.endpoint, list);
    }
    for (const [endpoint, list] of grouped) {
      const latencies = list.map((s) => s.latencyMs).sort((a, b) => a - b);
      const p95Idx = Math.floor(latencies.length * 0.95);
      const errors = list.filter((s) => s.statusCode >= 500).length;
      result.set(endpoint, {
        count: list.length,
        p95LatencyMs: latencies[p95Idx] ?? 0,
        errorRate: list.length > 0 ? errors / list.length : 0,
      });
    }
    return result;
  }
}

// ============ MTU-N504: Cache Hit Rate Analyzer ============

export class CacheHitRateAnalyzer {
  private hits = 0;
  private misses = 0;

  recordHit(): void {
    this.hits++;
  }

  recordMiss(): void {
    this.misses++;
  }

  hitRate(): number {
    const total = this.hits + this.misses;
    return total > 0 ? this.hits / total : 0;
  }

  reset(): void {
    this.hits = 0;
    this.misses = 0;
  }
}

// ============ MTU-N505: Retry Queue ============

export interface RetryItem<T> {
  id: string;
  payload: T;
  attempts: number;
  maxAttempts: number;
  nextAttemptAt: number;
  lastError?: string;
}

export class RetryQueue<T> {
  private items: Array<RetryItem<T>> = [];

  enqueue(id: string, payload: T, maxAttempts = 3): void {
    this.items.push({
      id,
      payload,
      attempts: 0,
      maxAttempts,
      nextAttemptAt: Date.now(),
    });
  }

  dueItems(now: number = Date.now()): Array<RetryItem<T>> {
    return this.items.filter((i) => i.nextAttemptAt <= now && i.attempts < i.maxAttempts);
  }

  markFailure(id: string, error: string): void {
    const item = this.items.find((i) => i.id === id);
    if (!item) return;
    item.attempts++;
    item.lastError = error;
    // 지수 백오프
    item.nextAttemptAt = Date.now() + Math.pow(2, item.attempts) * 1000;
  }

  markSuccess(id: string): void {
    this.items = this.items.filter((i) => i.id !== id);
  }

  deadLetter(): Array<RetryItem<T>> {
    return this.items.filter((i) => i.attempts >= i.maxAttempts).map((i) => ({ ...i }));
  }
}

// ============ MTU-N506: Delayed Task Scheduler ============

export interface DelayedTask<T> {
  id: string;
  runAt: number;
  payload: T;
}

export class DelayedTaskScheduler<T> {
  private tasks: Array<DelayedTask<T>> = [];

  schedule(id: string, delayMs: number, payload: T): void {
    this.tasks.push({ id, runAt: Date.now() + delayMs, payload });
  }

  drainDue(now: number = Date.now()): Array<DelayedTask<T>> {
    const due = this.tasks.filter((t) => t.runAt <= now);
    this.tasks = this.tasks.filter((t) => t.runAt > now);
    return due.map((t) => ({ ...t }));
  }

  cancel(id: string): boolean {
    const before = this.tasks.length;
    this.tasks = this.tasks.filter((t) => t.id !== id);
    return this.tasks.length < before;
  }
}

// ============ MTU-N507: Feature Toggle Runtime ============

export class FeatureToggleRuntime {
  private flags = new Map<string, boolean>();
  private percentRollout = new Map<string, number>();

  setFlag(name: string, enabled: boolean): void {
    this.flags.set(name, enabled);
  }

  setRollout(name: string, percent: number): void {
    this.percentRollout.set(name, Math.max(0, Math.min(100, percent)));
  }

  isEnabled(name: string, userId?: string): boolean {
    const flag = this.flags.get(name);
    if (flag === false) return false;
    const rollout = this.percentRollout.get(name);
    if (rollout !== undefined && userId) {
      const hash = this.hashString(userId);
      return hash % 100 < rollout;
    }
    return flag === true;
  }

  private hashString(s: string): number {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 31 + s.charCodeAt(i)) >>> 0;
    }
    return h;
  }
}

// ============ MTU-N508: API Version Compatibility ============

export interface ApiVersion {
  major: number;
  minor: number;
  patch: number;
}

export class ApiVersionChecker {
  parse(version: string): ApiVersion | null {
    const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
    if (!match) return null;
    return {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
    };
  }

  isCompatible(client: ApiVersion, server: ApiVersion): boolean {
    // Semver: major 일치 + client.minor <= server.minor
    if (client.major !== server.major) return false;
    if (client.minor > server.minor) return false;
    return true;
  }
}

// ============ MTU-N509: Canary Deployment Controller ============

export interface CanaryRollout {
  rolloutId: string;
  serviceName: string;
  newVersion: string;
  trafficPercent: number;
  startedAt: string;
  status: 'active' | 'promoted' | 'rolled-back';
}

export class CanaryController {
  private rollouts = new Map<string, CanaryRollout>();

  start(rolloutId: string, serviceName: string, newVersion: string): CanaryRollout {
    const rollout: CanaryRollout = {
      rolloutId,
      serviceName,
      newVersion,
      trafficPercent: 5,
      startedAt: new Date().toISOString(),
      status: 'active',
    };
    this.rollouts.set(rolloutId, rollout);
    return { ...rollout };
  }

  increaseTraffic(rolloutId: string, delta = 10): CanaryRollout {
    const r = this.rollouts.get(rolloutId);
    if (!r) throw new Error(`롤아웃 없음: ${rolloutId}`);
    r.trafficPercent = Math.min(100, r.trafficPercent + delta);
    return { ...r };
  }

  promote(rolloutId: string): CanaryRollout {
    const r = this.rollouts.get(rolloutId);
    if (!r) throw new Error(`롤아웃 없음: ${rolloutId}`);
    r.trafficPercent = 100;
    r.status = 'promoted';
    return { ...r };
  }

  rollback(rolloutId: string): CanaryRollout {
    const r = this.rollouts.get(rolloutId);
    if (!r) throw new Error(`롤아웃 없음: ${rolloutId}`);
    r.trafficPercent = 0;
    r.status = 'rolled-back';
    return { ...r };
  }
}

// ============ MTU-N510: Platform Checksum Validator ============

export class PlatformChecksumValidator {
  private expected = new Map<string, string>();

  register(component: string, sha256: string): void {
    this.expected.set(component, sha256);
  }

  verify(component: string, actualSha256: string): {
    valid: boolean;
    expected?: string;
    actual: string;
  } {
    const exp = this.expected.get(component);
    if (!exp) return { valid: false, actual: actualSha256 };
    return {
      valid: exp === actualSha256,
      expected: exp,
      actual: actualSha256,
    };
  }

  allComponents(): string[] {
    return Array.from(this.expected.keys());
  }
}
