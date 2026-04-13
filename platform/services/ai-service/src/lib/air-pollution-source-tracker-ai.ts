// Design Ref: §대기 오염 원인 추적 AI
// Plan SC: FR-R629.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

type Pollutant = 'pm25' | 'pm10' | 'no2' | 'so2' | 'o3' | 'co';
type SourceType = 'factory' | 'vehicle' | 'construction' | 'residential_heating' | 'wildfire' | 'cross_border';

interface SensorReading {
  sensorId: string;
  lat: number;
  lng: number;
  pollutant: Pollutant;
  value: number; // µg/m³
  timestamp: string;
  windDeg: number;
  windSpeedMs: number;
}

interface PollutionSource {
  sourceId: string;
  lat: number;
  lng: number;
  type: SourceType;
  emissionIntensity: number; // 0~100
}

interface AttributionResult {
  readingId: string;
  primaryPollutant: Pollutant;
  suspectedSources: Array<{ sourceId: string; type: SourceType; contribution: number; upwind: boolean }>;
  confidence: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function blockClassifiedData(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

const POLLUTION_THRESHOLD: Record<Pollutant, number> = {
  pm25: 35,
  pm10: 80,
  no2: 100,
  so2: 20,
  o3: 180,
  co: 9,
};

function bearingDeg(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLng = toRad(to.lng - from.lng);
  const y = Math.sin(dLng) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(dLng);
  const br = (Math.atan2(y, x) * 180) / Math.PI;
  return (br + 360) % 360;
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export class AirPollutionSourceTrackerAI {
  private sources = new Map<string, PollutionSource>();
  private results = new Map<string, AttributionResult>();
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R629.1
  registerSource(s: PollutionSource, grade: DataGrade = DataGrade.O): void {
    blockClassifiedData(grade);
    if (s.emissionIntensity < 0 || s.emissionIntensity > 100) {
      throw new Error('emissionIntensity 범위 오류');
    }
    this.sources.set(s.sourceId, s);
    this.log('REGISTER_SOURCE', { sourceId: s.sourceId });
  }

  // Plan SC: FR-R629.2
  isPolluted(reading: SensorReading): boolean {
    return reading.value > POLLUTION_THRESHOLD[reading.pollutant];
  }

  // Plan SC: FR-R629.3
  private isUpwind(reading: SensorReading, source: PollutionSource): boolean {
    const bearingSensorToSource = bearingDeg(
      { lat: reading.lat, lng: reading.lng },
      { lat: source.lat, lng: source.lng },
    );
    // 바람은 '부는 방향 (from)' 기준. 오염원이 바람 부는 방향(상류)에 있는지 검사
    // windDeg = 바람이 오는 방향. 따라서 source가 windDeg 근처에 있으면 upwind
    const diff = Math.abs(((bearingSensorToSource - reading.windDeg + 540) % 360) - 180);
    return diff < 45;
  }

  // Plan SC: FR-R629.4
  attribute(reading: SensorReading, grade: DataGrade = DataGrade.O): AttributionResult {
    blockClassifiedData(grade);
    if (reading.value < 0) throw new Error('측정값 음수 불가');
    const threshold = POLLUTION_THRESHOLD[reading.pollutant];
    const suspects: AttributionResult['suspectedSources'] = [];
    for (const source of this.sources.values()) {
      const dist = haversineKm({ lat: reading.lat, lng: reading.lng }, { lat: source.lat, lng: source.lng });
      if (dist > 50) continue; // 50km 이상 제외
      const upwind = this.isUpwind(reading, source);
      // 거리 역비례 + 배출강도 기반 기여도
      const contribution = +((source.emissionIntensity / Math.max(1, dist)) * (upwind ? 1.5 : 0.5)).toFixed(3);
      suspects.push({
        sourceId: source.sourceId,
        type: source.type,
        contribution,
        upwind,
      });
    }
    suspects.sort((a, b) => b.contribution - a.contribution);

    const totalCon = suspects.reduce((s, x) => s + x.contribution, 0);
    const confidence = +Math.min(1, totalCon / Math.max(1, threshold)).toFixed(2);

    const result: AttributionResult = {
      readingId: reading.sensorId + '@' + reading.timestamp,
      primaryPollutant: reading.pollutant,
      suspectedSources: suspects.slice(0, 5),
      confidence,
    };
    this.results.set(result.readingId, result);
    this.log('ATTRIBUTE', { readingId: result.readingId, suspects: suspects.length });
    return result;
  }

  // Plan SC: FR-R629.5
  getResult(readingId: string): AttributionResult | undefined {
    return this.results.get(readingId);
  }

  getAuditLog(): readonly AuditEntry[] {
    return this.audit;
  }
}
