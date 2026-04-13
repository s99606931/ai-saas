import { describe, it, expect, beforeEach } from 'vitest';
import { PublicMarketPriceMonitorAI } from '../public-market-price-monitor-ai';

describe('PublicMarketPriceMonitorAI', () => {
  let ai: PublicMarketPriceMonitorAI;

  beforeEach(() => {
    ai = new PublicMarketPriceMonitorAI();
  });

  it('가격 시계열을 저장한다', () => {
    ai.ingest({ productId: 'RICE', regionCode: 'SEL', date: '2026-04-01', priceKrw: 3000 });
    expect(ai.getSeries('RICE', 'SEL')).toHaveLength(1);
  });

  it('평균 대비 30% 이상 상승 시 alert', () => {
    for (let i = 0; i < 14; i++) {
      ai.ingest({ productId: 'NP', regionCode: 'SEL', date: `2026-03-${String(i + 1).padStart(2, '0')}`, priceKrw: 1000 });
    }
    ai.ingest({ productId: 'NP', regionCode: 'SEL', date: '2026-04-01', priceKrw: 1500 });
    const anomalies = ai.detectAnomalies('NP', 'SEL');
    expect(anomalies.some((a) => a.level === 'alert')).toBe(true);
  });

  it('15~30% 변동 시 warn', () => {
    for (let i = 0; i < 14; i++) {
      ai.ingest({ productId: 'CB', regionCode: 'BSN', date: `2026-03-${String(i + 1).padStart(2, '0')}`, priceKrw: 2000 });
    }
    ai.ingest({ productId: 'CB', regionCode: 'BSN', date: '2026-04-01', priceKrw: 2400 });
    const anomalies = ai.detectAnomalies('CB', 'BSN');
    expect(anomalies.some((a) => a.level === 'warn')).toBe(true);
  });

  it('변동 없는 경우 anomaly 없음', () => {
    for (let i = 0; i < 14; i++) {
      ai.ingest({ productId: 'ST', regionCode: 'DGU', date: `2026-03-${String(i + 1).padStart(2, '0')}`, priceKrw: 500 });
    }
    ai.ingest({ productId: 'ST', regionCode: 'DGU', date: '2026-04-01', priceKrw: 505 });
    expect(ai.detectAnomalies('ST', 'DGU')).toHaveLength(0);
  });

  it('전국 평균을 산출한다', () => {
    ai.ingest({ productId: 'AP', regionCode: 'SEL', date: '2026-04-01', priceKrw: 1000 });
    ai.ingest({ productId: 'AP', regionCode: 'BSN', date: '2026-04-01', priceKrw: 2000 });
    ai.ingest({ productId: 'AP', regionCode: 'DGU', date: '2026-04-01', priceKrw: 3000 });
    expect(ai.nationalAverage('AP')).toBe(2000);
  });

  it('음수 가격은 오류', () => {
    expect(() => ai.ingest({ productId: 'X', regionCode: 'Y', date: '2026-04-01', priceKrw: -1 })).toThrow();
  });
});
