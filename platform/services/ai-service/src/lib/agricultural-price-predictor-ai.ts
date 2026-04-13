// Design Ref: §농수산물 가격 예측 — 이동평균 + 계절성 보정 모델
// Plan SC: FR-R523.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ProductCategory = 'vegetable' | 'fruit' | 'grain' | 'seafood' | 'livestock';
export type Season = 'spring' | 'summer' | 'autumn' | 'winter';

export interface PriceRecord {
  productId: string;
  recordedAt: string;
  pricePerKg: number;
}

export interface ProductInfo {
  productId: string;
  name: string;
  category: ProductCategory;
  peakSeason: Season;
}

export interface PricePrediction {
  productId: string;
  predictedPrice: number;
  movingAverage: number;
  volatility: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const SEASON_FACTOR: Record<Season, number> = {
  spring: 1.0,
  summer: 1.05,
  autumn: 0.92,
  winter: 1.12,
};

export class AgriculturalPricePredictorAI {
  private products = new Map<string, ProductInfo>();
  private history = new Map<string, PriceRecord[]>();
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R523.1
  registerProduct(info: ProductInfo, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.products.set(info.productId, { ...info });
    if (!this.history.has(info.productId)) this.history.set(info.productId, []);
    this.append('REGISTER_PRODUCT', { productId: info.productId, category: info.category });
  }

  // Plan SC: FR-R523.2
  recordPrice(record: PriceRecord, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (!this.products.has(record.productId)) throw new Error(`상품 미등록: ${record.productId}`);
    if (record.pricePerKg < 0) throw new Error('가격은 0 이상이어야 합니다');
    const list = this.history.get(record.productId) ?? [];
    list.push({ ...record });
    this.history.set(record.productId, list);
    this.append('RECORD_PRICE', { productId: record.productId, price: record.pricePerKg });
  }

  // Plan SC: FR-R523.3
  predict(productId: string, currentSeason: Season, grade: DataGrade = 'O'): PricePrediction {
    blockClassifiedData(grade);
    const product = this.products.get(productId);
    if (!product) throw new Error(`상품 미등록: ${productId}`);
    const records = this.history.get(productId) ?? [];
    if (records.length < 3) throw new Error(`가격 이력 부족: ${records.length}건 (최소 3건 필요)`);

    const prices = records.map(r => r.pricePerKg);
    const windowSize = Math.min(7, prices.length);
    const recent = prices.slice(-windowSize);
    const movingAverage = recent.reduce((s, v) => s + v, 0) / recent.length;

    const mean = prices.reduce((s, v) => s + v, 0) / prices.length;
    const variance = prices.reduce((s, v) => s + (v - mean) ** 2, 0) / prices.length;
    const volatility = Math.sqrt(variance);

    const first = prices[0] ?? 0;
    const last = prices[prices.length - 1] ?? 0;
    const drift = last - first;
    const trend: 'up' | 'down' | 'stable' = drift > volatility ? 'up' : drift < -volatility ? 'down' : 'stable';

    const seasonAdjust = SEASON_FACTOR[currentSeason];
    const peakBoost = currentSeason === product.peakSeason ? 0.95 : 1.0;
    const predictedPrice = Math.round(movingAverage * seasonAdjust * peakBoost * 100) / 100;

    const confidence = Math.max(0, Math.min(100, Math.round((1 - volatility / Math.max(1, mean)) * 100)));

    const prediction: PricePrediction = {
      productId,
      predictedPrice,
      movingAverage: Math.round(movingAverage * 100) / 100,
      volatility: Math.round(volatility * 100) / 100,
      trend,
      confidence,
    };
    this.append('PREDICT', { productId, predictedPrice, trend });
    return prediction;
  }

  // Plan SC: FR-R523.4
  listProducts(category?: ProductCategory): ProductInfo[] {
    const all = Array.from(this.products.values());
    return (category ? all.filter(p => p.category === category) : all).map(p => ({ ...p }));
  }

  // Plan SC: FR-R523.5
  getHistory(productId: string): PriceRecord[] {
    return (this.history.get(productId) ?? []).map(r => ({ ...r }));
  }

  // Plan SC: FR-R523.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
