// Design Ref: §공공 시장 가격 모니터링 AI — 농수산물 가격 이상 탐지
// Plan SC: FR-R587.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface PricePoint {
  productId: string;
  regionCode: string;
  date: string; // YYYY-MM-DD
  priceKrw: number; // 단위당
}

export interface PriceAnomaly {
  productId: string;
  regionCode: string;
  date: string;
  priceKrw: number;
  baselineKrw: number;
  deltaPct: number;
  level: 'warn' | 'alert';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class PublicMarketPriceMonitorAI {
  private readonly audit: AuditEntry[] = [];
  private readonly series = new Map<string, PricePoint[]>(); // key: productId|regionCode

  private key(productId: string, region: string): string {
    return `${productId}|${region}`;
  }

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  ingest(point: PricePoint, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (point.priceKrw < 0) throw new Error('priceKrw는 음수 불가');
    const k = this.key(point.productId, point.regionCode);
    const arr = this.series.get(k) ?? [];
    arr.push(point);
    this.series.set(k, arr);
    this.log('INGEST', { productId: point.productId, region: point.regionCode });
  }

  private baselineOf(points: PricePoint[]): number {
    if (points.length === 0) return 0;
    const recent = points.slice(-14); // 최근 14일
    const sum = recent.reduce((s, p) => s + p.priceKrw, 0);
    return sum / recent.length;
  }

  detectAnomalies(productId: string, regionCode: string, warnPct = 15, alertPct = 30, grade: DataGrade = 'O'): PriceAnomaly[] {
    blockClassifiedData(grade);
    const arr = this.series.get(this.key(productId, regionCode)) ?? [];
    if (arr.length < 2) return [];
    const baseline = this.baselineOf(arr.slice(0, -1));
    if (baseline <= 0) return [];

    const last = arr[arr.length - 1]!;
    const deltaPct = ((last.priceKrw - baseline) / baseline) * 100;
    const anomalies: PriceAnomaly[] = [];

    if (Math.abs(deltaPct) >= alertPct) {
      anomalies.push({
        productId,
        regionCode,
        date: last.date,
        priceKrw: last.priceKrw,
        baselineKrw: Math.round(baseline),
        deltaPct: Math.round(deltaPct * 10) / 10,
        level: 'alert',
      });
    } else if (Math.abs(deltaPct) >= warnPct) {
      anomalies.push({
        productId,
        regionCode,
        date: last.date,
        priceKrw: last.priceKrw,
        baselineKrw: Math.round(baseline),
        deltaPct: Math.round(deltaPct * 10) / 10,
        level: 'warn',
      });
    }
    this.log('DETECT', { productId, regionCode, anomalyCount: anomalies.length });
    return anomalies;
  }

  nationalAverage(productId: string, grade: DataGrade = 'O'): number {
    blockClassifiedData(grade);
    const prices: number[] = [];
    for (const [k, arr] of this.series.entries()) {
      if (k.startsWith(`${productId}|`) && arr.length > 0) {
        const last = arr[arr.length - 1]!;
        prices.push(last.priceKrw);
      }
    }
    if (prices.length === 0) return 0;
    return Math.round(prices.reduce((s, p) => s + p, 0) / prices.length);
  }

  getSeries(productId: string, regionCode: string): PricePoint[] {
    return [...(this.series.get(this.key(productId, regionCode)) ?? [])];
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
