/**
 * 재생에너지 사용 최적화 AI
 * Design Ref: MTU-N453 §3
 * Plan SC: FR-RE.1~5
 */

import { z } from 'zod';

export const WeatherForecastSchema = z.object({
  hour: z.number().int().min(0).max(23),
  solarIrradianceWm2: z.number().nonnegative(),
  windSpeedMs: z.number().nonnegative(),
  cloudCoverPercent: z.number().min(0).max(100),
});

export type WeatherForecast = z.infer<typeof WeatherForecastSchema>;

export interface GenerationForecast {
  hour: number;
  solarKw: number;
  windKw: number;
  totalKw: number;
}

export interface LoadProfile {
  hour: number;
  demandKw: number;
  flexible: boolean;
}

/**
 * 재생E 생산량 예측기 (FR-RE.1)
 */
export class GenerationForecaster {
  constructor(
    private solarCapacityKw: number,
    private windCapacityKw: number,
  ) {}

  forecast24h(weather: WeatherForecast[]): GenerationForecast[] {
    return weather.map((w) => {
      const validated = WeatherForecastSchema.parse(w);
      // 단순 물리 모델: 일사량·풍속 → 출력 계수
      const solarEfficiency = Math.min(validated.solarIrradianceWm2 / 1000, 1);
      const cloudFactor = 1 - validated.cloudCoverPercent / 200; // 절반 감쇄
      const solarKw = this.solarCapacityKw * solarEfficiency * cloudFactor;

      // 풍력: cut-in 3m/s, rated 12m/s, cut-out 25m/s
      let windKw = 0;
      if (validated.windSpeedMs >= 3 && validated.windSpeedMs < 12) {
        windKw = this.windCapacityKw * ((validated.windSpeedMs - 3) / 9);
      } else if (validated.windSpeedMs >= 12 && validated.windSpeedMs < 25) {
        windKw = this.windCapacityKw;
      }

      return {
        hour: validated.hour,
        solarKw: Math.round(solarKw * 100) / 100,
        windKw: Math.round(windKw * 100) / 100,
        totalKw: Math.round((solarKw + windKw) * 100) / 100,
      };
    });
  }
}

/**
 * 부하 이동 추천 엔진 (FR-RE.3)
 */
export class LoadShiftOptimizer {
  /**
   * 재생E가 풍부한 시간대로 유연 부하 이동
   */
  optimize(
    forecast: GenerationForecast[],
    loads: LoadProfile[],
  ): {
    shiftedLoads: LoadProfile[];
    renewableRatioPercent: number;
    shiftCount: number;
  } {
    // 생산량 상위 시간대 식별
    const sortedByGen = [...forecast].sort((a, b) => b.totalKw - a.totalKw);
    const topHours = sortedByGen.slice(0, 6).map((f) => f.hour);

    const shiftedLoads: LoadProfile[] = [];
    let shiftCount = 0;

    for (const load of loads) {
      if (load.flexible && !topHours.includes(load.hour)) {
        const targetHour = topHours[shiftCount % topHours.length] ?? load.hour;
        shiftedLoads.push({ ...load, hour: targetHour });
        shiftCount++;
      } else {
        shiftedLoads.push({ ...load });
      }
    }

    // 재생E 비율 계산
    const totalDemand = shiftedLoads.reduce((s, l) => s + l.demandKw, 0);
    let renewableUsed = 0;
    for (const load of shiftedLoads) {
      const gen = forecast.find((f) => f.hour === load.hour);
      if (gen) {
        renewableUsed += Math.min(load.demandKw, gen.totalKw);
      }
    }
    const renewableRatioPercent = totalDemand > 0 ? (renewableUsed / totalDemand) * 100 : 0;

    return {
      shiftedLoads,
      renewableRatioPercent: Math.round(renewableRatioPercent * 10) / 10,
      shiftCount,
    };
  }
}

/**
 * REC 거래 시뮬레이션 (FR-RE.4)
 */
export class RecSimulator {
  simulate(
    surplus: GenerationForecast[],
    recPricePerMwh: number,
  ): { revenueKrw: number; mwh: number } {
    const mwh = surplus.reduce((s, f) => s + f.totalKw / 1000, 0);
    return {
      mwh: Math.round(mwh * 100) / 100,
      revenueKrw: Math.round(mwh * recPricePerMwh),
    };
  }
}
