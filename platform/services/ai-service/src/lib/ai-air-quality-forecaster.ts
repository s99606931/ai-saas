// Design Ref: §대기질 예보 — PM2.5/PM10/O3 시계열 기반 단기 예측
// Plan SC: FR-R603.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type Pollutant = 'pm25' | 'pm10' | 'o3' | 'no2';

export interface AirQualityReading {
  stationId: string;
  timestamp: string;
  pollutant: Pollutant;
  value: number;
}

export interface Forecast {
  stationId: string;
  pollutant: Pollutant;
  forecastValue: number;
  aqiLevel: 'good' | 'moderate' | 'unhealthy_sensitive' | 'unhealthy' | 'hazardous';
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIAirQualityForecaster {
  private readings: AirQualityReading[] = [];
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R603.1
  recordReading(reading: AirQualityReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (reading.value < 0) throw new Error('측정값은 0 이상이어야 합니다');
    if (!reading.stationId) throw new Error('측정소 ID가 필요합니다');
    this.readings.push({ ...reading });
    this.append('RECORD_READING', { stationId: reading.stationId, pollutant: reading.pollutant });
  }

  private classifyPM25(v: number): Forecast['aqiLevel'] {
    if (v <= 15) return 'good';
    if (v <= 35) return 'moderate';
    if (v <= 55) return 'unhealthy_sensitive';
    if (v <= 75) return 'unhealthy';
    return 'hazardous';
  }

  private classifyPM10(v: number): Forecast['aqiLevel'] {
    if (v <= 30) return 'good';
    if (v <= 80) return 'moderate';
    if (v <= 120) return 'unhealthy_sensitive';
    if (v <= 150) return 'unhealthy';
    return 'hazardous';
  }

  private classifyOther(v: number): Forecast['aqiLevel'] {
    if (v <= 30) return 'good';
    if (v <= 60) return 'moderate';
    if (v <= 90) return 'unhealthy_sensitive';
    if (v <= 120) return 'unhealthy';
    return 'hazardous';
  }

  // Plan SC: FR-R603.2
  forecast(stationId: string, pollutant: Pollutant, grade: DataGrade = 'O'): Forecast {
    blockClassifiedData(grade);
    const series = this.readings
      .filter(r => r.stationId === stationId && r.pollutant === pollutant)
      .slice(-5);
    if (series.length === 0) {
      throw new Error(`측정 데이터 없음: ${stationId}/${pollutant}`);
    }

    // 가중 이동 평균 (최근일수록 가중치 높음)
    let weightSum = 0;
    let valueSum = 0;
    series.forEach((r, i) => {
      const w = i + 1;
      weightSum += w;
      valueSum += r.value * w;
    });
    const forecastValue = Math.round((valueSum / weightSum) * 100) / 100;

    let aqiLevel: Forecast['aqiLevel'];
    if (pollutant === 'pm25') aqiLevel = this.classifyPM25(forecastValue);
    else if (pollutant === 'pm10') aqiLevel = this.classifyPM10(forecastValue);
    else aqiLevel = this.classifyOther(forecastValue);

    this.append('FORECAST', { stationId, pollutant, forecastValue, aqiLevel });
    return { stationId, pollutant, forecastValue, aqiLevel };
  }

  // Plan SC: FR-R603.3
  latestReading(stationId: string, pollutant: Pollutant): AirQualityReading | undefined {
    const filtered = this.readings.filter(r => r.stationId === stationId && r.pollutant === pollutant);
    if (filtered.length === 0) return undefined;
    const last = filtered[filtered.length - 1]!;
    return { ...last };
  }

  // Plan SC: FR-R603.4
  alertIfUnhealthy(stationId: string, pollutant: Pollutant): boolean {
    const f = this.forecast(stationId, pollutant);
    return f.aqiLevel === 'unhealthy' || f.aqiLevel === 'hazardous' || f.aqiLevel === 'unhealthy_sensitive';
  }

  // Plan SC: FR-R603.5
  countReadings(stationId?: string): number {
    if (!stationId) return this.readings.length;
    return this.readings.filter(r => r.stationId === stationId).length;
  }

  // Plan SC: FR-R603.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
