// Design Ref: MTU-N433 §코스트 관찰성
// Plan SC: FR-N433.1~5

export interface EndpointUsage {
  endpoint: string;
  method: string;
  cpuSeconds: number;
  memoryGbSeconds: number;
  networkGb: number;
  invocations: number;
}

export interface PriceTable {
  cpuPerSecondKrw: number;
  memoryGbSecondKrw: number;
  networkGbKrw: number;
}

export interface EndpointCost {
  endpoint: string;
  totalKrw: number;
  perInvocationKrw: number;
  breakdown: { cpu: number; memory: number; network: number };
}

export interface DailyCostPoint {
  date: string;
  endpoint: string;
  totalKrw: number;
}

export interface CostAnomaly {
  endpoint: string;
  date: string;
  actualKrw: number;
  meanKrw: number;
  stdDev: number;
  zScore: number;
}

export class CostObservabilityEngine {
  /** FR-N433.1 사용량 정규화 */
  normalizeUsage(raw: EndpointUsage[]): EndpointUsage[] {
    return raw.filter((u) => u.invocations > 0);
  }

  /** FR-N433.2 단가 테이블 검증 */
  validatePriceTable(table: PriceTable): boolean {
    return table.cpuPerSecondKrw >= 0 && table.memoryGbSecondKrw >= 0 && table.networkGbKrw >= 0;
  }

  /** FR-N433.3 비용 계산 */
  computeCosts(usage: EndpointUsage[], price: PriceTable): EndpointCost[] {
    const result: EndpointCost[] = [];
    for (const u of usage) {
      const cpu = u.cpuSeconds * price.cpuPerSecondKrw;
      const memory = u.memoryGbSeconds * price.memoryGbSecondKrw;
      const network = u.networkGb * price.networkGbKrw;
      const total = cpu + memory + network;
      result.push({
        endpoint: `${u.method} ${u.endpoint}`,
        totalKrw: +total.toFixed(2),
        perInvocationKrw: +(total / u.invocations).toFixed(4),
        breakdown: { cpu: +cpu.toFixed(2), memory: +memory.toFixed(2), network: +network.toFixed(2) },
      });
    }
    return result;
  }

  /** FR-N433.4 이상치 탐지 (2σ) */
  detectAnomalies(history: DailyCostPoint[]): CostAnomaly[] {
    const byEndpoint = new Map<string, DailyCostPoint[]>();
    for (const h of history) {
      const list = byEndpoint.get(h.endpoint) ?? [];
      list.push(h);
      byEndpoint.set(h.endpoint, list);
    }
    const anomalies: CostAnomaly[] = [];
    for (const [endpoint, points] of byEndpoint) {
      if (points.length < 3) continue;
      const values = points.map((p) => p.totalKrw);
      const mean = values.reduce<number>((a, b) => a + b, 0) / values.length;
      const variance = values.reduce<number>((a, b) => a + (b - mean) ** 2, 0) / values.length;
      const std = Math.sqrt(variance);
      for (const p of points) {
        const z = std === 0 ? 0 : (p.totalKrw - mean) / std;
        if (Math.abs(z) >= 2) {
          anomalies.push({
            endpoint,
            date: p.date,
            actualKrw: p.totalKrw,
            meanKrw: +mean.toFixed(2),
            stdDev: +std.toFixed(2),
            zScore: +z.toFixed(2),
          });
        }
      }
    }
    return anomalies;
  }

  /** FR-N433.5 월간 리포트 */
  generateReport(costs: EndpointCost[], month: string): string {
    const sorted = [...costs].sort((a, b) => b.totalKrw - a.totalKrw);
    const total = sorted.reduce<number>((acc, c) => acc + c.totalKrw, 0);
    const lines: string[] = [`# ${month} 비용 리포트`, ``, `총 비용: ${total.toFixed(2)}원`, '', '## 상위 엔드포인트'];
    for (const c of sorted.slice(0, 10)) {
      lines.push(`- ${c.endpoint}: ${c.totalKrw}원 (호출당 ${c.perInvocationKrw}원)`);
    }
    return lines.join('\n');
  }
}

export const costObservabilityEngine = new CostObservabilityEngine();
