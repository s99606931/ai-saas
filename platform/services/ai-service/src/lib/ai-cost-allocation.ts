// AI Cost Allocation — FR-R55.1~R55.6
// Design Ref: SVC-AI-ADV-R55 DESIGN §2, §3, §4
// Plan SC: 호출별 비용 100% 기록, 월별 오차 < 0.1%
// CSAP: D-06 감사 로깅

// ── 타입 ─────────────────────────────────────────────────────────────────────

export interface CallRecord {
  id: string;
  tenantId: string;
  modelId: string;
  inputTokens: number;
  outputTokens: number;
  timestamp: number;
}

export interface PricingRule {
  modelId: string;
  inputPerKTok: number;
  outputPerKTok: number;
  effectiveFrom: number;
}

export interface CostEntry extends CallRecord {
  cost: number;
}

export interface AggregateRow {
  key: string;
  calls: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

export interface CostAuditEntry {
  timestamp: number;
  action: 'COST_RECORDED' | 'PRICING_CHANGED' | 'AGGREGATE_EXECUTED';
  detail?: string;
}

// ── AiCostAllocation ─────────────────────────────────────────────────────────

/**
 * AI API 호출 비용 추적 및 집계.
 * 테넌트별·모델별 월 정산을 위한 인메모리 저장소를 제공합니다.
 */
export class AiCostAllocation {
  private readonly entries: CostEntry[] = [];
  private readonly pricing = new Map<string, PricingRule[]>();
  private readonly auditLog: CostAuditEntry[] = [];

  // ── FR-R55.2: 단가 테이블 ─────────────────────────────────────────────────

  setPricing(rule: PricingRule): void {
    if (rule.inputPerKTok < 0 || rule.outputPerKTok < 0) {
      throw new Error('COST_INVALID_PRICING');
    }
    const list = this.pricing.get(rule.modelId) ?? [];
    list.push(rule);
    // effectiveFrom 오름차순 정렬
    list.sort((a, b) => a.effectiveFrom - b.effectiveFrom);
    this.pricing.set(rule.modelId, list);
    this.audit({
      timestamp: Date.now(),
      action: 'PRICING_CHANGED',
      detail: rule.modelId,
    });
  }

  getPricing(modelId: string, at: number): PricingRule | undefined {
    const list = this.pricing.get(modelId);
    if (!list || list.length === 0) return undefined;
    let selected: PricingRule | undefined;
    for (const rule of list) {
      if (rule.effectiveFrom <= at) {
        selected = rule;
      } else {
        break;
      }
    }
    return selected;
  }

  // ── FR-R55.3: 비용 계산 ──────────────────────────────────────────────────

  computeCost(record: CallRecord): number {
    const rule = this.getPricing(record.modelId, record.timestamp);
    if (!rule) {
      throw new Error(`COST_PRICING_NOT_FOUND:${record.modelId}`);
    }
    const input = (record.inputTokens / 1000) * rule.inputPerKTok;
    const output = (record.outputTokens / 1000) * rule.outputPerKTok;
    return +(input + output).toFixed(6);
  }

  // ── FR-R55.1: 호출 기록 ──────────────────────────────────────────────────

  record(call: CallRecord): CostEntry {
    if (call.inputTokens < 0 || call.outputTokens < 0) {
      throw new Error('COST_INVALID_TOKENS');
    }
    const cost = this.computeCost(call);
    const entry: CostEntry = { ...call, cost };
    this.entries.push(entry);
    this.audit({
      timestamp: Date.now(),
      action: 'COST_RECORDED',
      detail: `${call.tenantId}/${call.modelId}`,
    });
    return entry;
  }

  // ── FR-R55.4: 테넌트별 집계 ───────────────────────────────────────────────

  aggregateByTenant(from: number, to: number): Map<string, AggregateRow> {
    return this.aggregateBy(from, to, (e) => e.tenantId);
  }

  // ── FR-R55.5: 모델별 집계 ────────────────────────────────────────────────

  aggregateByModel(from: number, to: number): Map<string, AggregateRow> {
    return this.aggregateBy(from, to, (e) => e.modelId);
  }

  // ── FR-R55.6: 감사 로그 ──────────────────────────────────────────────────

  getAuditLog(): readonly CostAuditEntry[] {
    return this.auditLog;
  }

  getEntries(): readonly CostEntry[] {
    return this.entries;
  }

  // ── 내부 ──────────────────────────────────────────────────────────────────

  private aggregateBy(
    from: number,
    to: number,
    keyFn: (e: CostEntry) => string,
  ): Map<string, AggregateRow> {
    const result = new Map<string, AggregateRow>();
    for (const e of this.entries) {
      if (e.timestamp < from || e.timestamp >= to) continue;
      const key = keyFn(e);
      const row = result.get(key) ?? {
        key,
        calls: 0,
        inputTokens: 0,
        outputTokens: 0,
        cost: 0,
      };
      row.calls += 1;
      row.inputTokens += e.inputTokens;
      row.outputTokens += e.outputTokens;
      row.cost = +(row.cost + e.cost).toFixed(6);
      result.set(key, row);
    }
    this.audit({
      timestamp: Date.now(),
      action: 'AGGREGATE_EXECUTED',
      detail: `${from}-${to}`,
    });
    return result;
  }

  private audit(entry: CostAuditEntry): void {
    this.auditLog.push(entry);
  }
}
