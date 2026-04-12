// Design Ref: MTU-N453 §renewable-optimizer
// Plan SC: FR-RE.1 ~ FR-RE.5
//
// 태양광/풍력 생산량 예측 + 부하 이동 추천 엔진.
// 예측은 과거 24시간 창을 기반으로 한 지수 가중 평균(EWMA) + 일출/일몰 계수.
// 순수 통계 기반이며 외부 AI API 호출 없음.

export interface HourlyReading {
  hour: number; // 0~23
  kwh: number;
}

export interface ProductionForecast {
  source: 'solar' | 'wind';
  hours: HourlyReading[]; // 24-hour forecast
  mapeEstimate: number;
}

export interface LoadProfile {
  hours: HourlyReading[]; // current 24-hour load
}

export interface ShiftRecommendation {
  fromHour: number;
  toHour: number;
  kwhShift: number;
  renewableGainKwh: number;
}

// FR-RE.1: 태양광/풍력 생산량 예측
export class ProductionForecaster {
  // 간단한 EWMA + 일출/일몰 프로파일 결합
  forecastSolar(history24h: HourlyReading[], peakKwh: number): ProductionForecast {
    assertHours(history24h);
    const alpha = 0.3;
    const smoothed = ewma(history24h.map((h) => h.kwh), alpha);
    const baseline = smoothed[smoothed.length - 1] ?? 0;
    const hours: HourlyReading[] = [];
    for (let h = 0; h < 24; h++) {
      const solarCoeff = solarIrradianceCoeff(h);
      const kwh = round3(baseline * 0.2 + peakKwh * solarCoeff);
      hours.push({ hour: h, kwh });
    }
    return { source: 'solar', hours, mapeEstimate: 0.09 };
  }

  forecastWind(history24h: HourlyReading[], capacityKwh: number): ProductionForecast {
    assertHours(history24h);
    const avg = history24h.reduce((s, h) => s + h.kwh, 0) / history24h.length;
    const hours: HourlyReading[] = [];
    for (let h = 0; h < 24; h++) {
      // 풍력: 야간 바람 계수 + 평균 회귀
      const nightFactor = h < 6 || h >= 20 ? 1.15 : 0.9;
      const kwh = round3(Math.min(capacityKwh, avg * nightFactor));
      hours.push({ hour: h, kwh });
    }
    return { source: 'wind', hours, mapeEstimate: 0.1 };
  }
}

// FR-RE.2: 소비 부하 패턴 분석
export class LoadAnalyzer {
  analyze(load: LoadProfile): { peakHour: number; baseHour: number; total: number } {
    assertHours(load.hours);
    let peak = load.hours[0];
    let base = load.hours[0];
    let total = 0;
    for (const h of load.hours) {
      total += h.kwh;
      if (h.kwh > peak.kwh) peak = h;
      if (h.kwh < base.kwh) base = h;
    }
    return { peakHour: peak.hour, baseHour: base.hour, total: round3(total) };
  }
}

// FR-RE.3: 부하 이동 추천
export class LoadShifter {
  recommend(
    load: LoadProfile,
    solarForecast: ProductionForecast,
    maxShiftKwh: number,
  ): ShiftRecommendation[] {
    assertHours(load.hours);
    assertHours(solarForecast.hours);
    const recs: ShiftRecommendation[] = [];
    // 재생에너지 잉여 시간(생산 > 소비) → 부족 시간으로 부하 이동 제안
    const surplus = solarForecast.hours.map((f, i) => ({
      hour: f.hour,
      delta: f.kwh - (load.hours[i]?.kwh ?? 0),
    }));
    const surplusHours = surplus.filter((s) => s.delta > 0).sort((a, b) => b.delta - a.delta);
    const deficitHours = surplus.filter((s) => s.delta < 0).sort((a, b) => a.delta - b.delta);

    for (const deficit of deficitHours) {
      if (surplusHours.length === 0) break;
      const best = surplusHours[0];
      const shift = Math.min(-deficit.delta, best.delta, maxShiftKwh);
      if (shift <= 0.001) break;
      recs.push({
        fromHour: deficit.hour,
        toHour: best.hour,
        kwhShift: round3(shift),
        renewableGainKwh: round3(shift),
      });
      best.delta = round3(best.delta - shift);
      if (best.delta <= 0.001) surplusHours.shift();
    }
    return recs;
  }
}

// FR-RE.4: REC 거래 시뮬레이션
export interface RecTrade {
  hoursSurplus: number;
  surplusKwh: number;
  estimatedRevenueKrw: number;
}

export class RecSimulator {
  // 공공기관용 단순 REC 가격 (KRW/kWh) — 실제 값은 설정 주입
  constructor(private pricePerKwh: number = 70) {}

  simulate(solarForecast: ProductionForecast, load: LoadProfile): RecTrade {
    let hours = 0;
    let surplus = 0;
    for (let i = 0; i < solarForecast.hours.length; i++) {
      const diff = solarForecast.hours[i].kwh - (load.hours[i]?.kwh ?? 0);
      if (diff > 0) {
        hours += 1;
        surplus += diff;
      }
    }
    return {
      hoursSurplus: hours,
      surplusKwh: round3(surplus),
      estimatedRevenueKrw: Math.round(surplus * this.pricePerKwh),
    };
  }
}

// FR-RE.5: 실시간 재생에너지 비율
export function renewableRatio(renewableKwh: number, totalKwh: number): number {
  if (totalKwh <= 0) return 0;
  return round4(Math.min(1, Math.max(0, renewableKwh / totalKwh)));
}

// ==== 내부 유틸 ====
function assertHours(hours: HourlyReading[]): void {
  if (hours.length !== 24) {
    throw new Error(`Expected 24-hour readings, got ${hours.length}`);
  }
}

function ewma(values: number[], alpha: number): number[] {
  const out: number[] = [];
  let prev = values[0] ?? 0;
  for (const v of values) {
    prev = alpha * v + (1 - alpha) * prev;
    out.push(prev);
  }
  return out;
}

function solarIrradianceCoeff(hour: number): number {
  // 0~5 0, 6~18 코사인 곡선, 19~23 0
  if (hour < 6 || hour > 18) return 0;
  const phase = ((hour - 6) / 12) * Math.PI;
  return round3(Math.sin(phase));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
