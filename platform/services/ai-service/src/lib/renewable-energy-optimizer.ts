// Design Ref: MTU-N453 §재생에너지 최적화
// Plan SC: FR-RE.1~5

export interface GenerationPoint {
  hour: number;
  solarKwh: number;
  windKwh: number;
}

export interface ConsumptionPoint {
  hour: number;
  loadKwh: number;
  shiftable: boolean;
}

export interface LoadShiftRecommendation {
  fromHour: number;
  toHour: number;
  kwh: number;
  reason: string;
}

export interface RenewableRatioSnapshot {
  hour: number;
  ratio: number;
  renewableKwh: number;
  totalKwh: number;
}

export class RenewableEnergyOptimizer {
  /** FR-RE.1 생산량 예측 (24시간, 단순 패턴) */
  forecastGeneration(baseSolarPeak: number, baseWindAvg: number): GenerationPoint[] {
    const out: GenerationPoint[] = [];
    for (let h = 0; h < 24; h++) {
      // 태양광: 6~18시 정오에 피크
      const solar = h >= 6 && h <= 18 ? +(baseSolarPeak * Math.sin(((h - 6) / 12) * Math.PI)).toFixed(2) : 0;
      // 풍력: 평균값에 noise (deterministic)
      const wind = +(baseWindAvg * (0.8 + 0.4 * ((h % 5) / 5))).toFixed(2);
      out.push({ hour: h, solarKwh: solar, windKwh: wind });
    }
    return out;
  }

  /** FR-RE.2 소비 부하 분석 */
  analyzeConsumption(points: ConsumptionPoint[]): { peak: ConsumptionPoint; offPeak: ConsumptionPoint; shiftableTotal: number } {
    if (points.length === 0) {
      throw new Error('RENEWABLE_CONSUMPTION_EMPTY');
    }
    const peak = [...points].sort((a, b) => b.loadKwh - a.loadKwh)[0]!;
    const offPeak = [...points].sort((a, b) => a.loadKwh - b.loadKwh)[0]!;
    const shiftableTotal = points.filter((p) => p.shiftable).reduce((s, p) => s + p.loadKwh, 0);
    return { peak, offPeak, shiftableTotal };
  }

  /** FR-RE.3 부하 이동 추천 */
  recommendShifts(
    generation: GenerationPoint[],
    consumption: ConsumptionPoint[],
  ): LoadShiftRecommendation[] {
    const recs: LoadShiftRecommendation[] = [];
    for (const c of consumption) {
      if (!c.shiftable) continue;
      const gen = generation[c.hour];
      const totalRenew = (gen?.solarKwh ?? 0) + (gen?.windKwh ?? 0);
      if (c.loadKwh > totalRenew) {
        // 가장 재생에너지가 풍부한 시간 찾기
        let bestHour = c.hour;
        let bestRenew = totalRenew;
        for (const g of generation) {
          const rg = g.solarKwh + g.windKwh;
          if (rg > bestRenew) {
            bestRenew = rg;
            bestHour = g.hour;
          }
        }
        if (bestHour !== c.hour) {
          recs.push({
            fromHour: c.hour,
            toHour: bestHour,
            kwh: c.loadKwh,
            reason: `재생E 풍부 시간대(${bestHour}시)로 이동`,
          });
        }
      }
    }
    return recs;
  }

  /** FR-RE.4 REC 거래 시뮬레이션 */
  simulateRecTrade(surplusKwh: number, pricePerKwh: number): { surplusKwh: number; revenue: number } {
    const revenue = +(surplusKwh * pricePerKwh).toFixed(2);
    return { surplusKwh, revenue };
  }

  /** FR-RE.5 재생E 비율 스냅샷 */
  calculateRatios(
    generation: GenerationPoint[],
    consumption: ConsumptionPoint[],
  ): RenewableRatioSnapshot[] {
    return generation.map((g) => {
      const load = consumption[g.hour]?.loadKwh ?? 0;
      const renew = g.solarKwh + g.windKwh;
      const total = load;
      const ratio = total === 0 ? 0 : +(Math.min(renew, total) / total).toFixed(3);
      return { hour: g.hour, ratio, renewableKwh: renew, totalKwh: total };
    });
  }
}

export const renewableEnergyOptimizer = new RenewableEnergyOptimizer();
