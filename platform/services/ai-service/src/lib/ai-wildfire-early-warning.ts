// Design Ref: §핵심 알고리즘 — 다중 변수 산불 위험 지수 계산 모델
// Plan SC: FR-R511.1~5

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

interface ForestSensorReading {
  sensorId: string;
  region: string;
  temperatureC: number;
  humidityPct: number;
  windSpeedMs: number;
  vegetationDryness: number; // 0 ~ 1
  reportedAt: string;
}

type RiskLevel = 'safe' | 'caution' | 'warning' | 'critical';

interface WildfireRiskAssessment {
  region: string;
  riskScore: number; // 0 ~ 100
  riskLevel: RiskLevel;
  evacuationRecommended: boolean;
  recommendation: string;
}

interface AlertRecord {
  region: string;
  level: RiskLevel;
  riskScore: number;
  issuedAt: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIWildfireEarlyWarning {
  private sensors = new Map<string, ForestSensorReading>();
  private alerts: AlertRecord[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private appendAudit(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R511.1
  ingestReading(reading: ForestSensorReading, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.sensors.set(reading.sensorId, reading);
    this.appendAudit('INGEST_READING', { sensorId: reading.sensorId, region: reading.region });
  }

  // Plan SC: FR-R511.2
  computeRiskScore(reading: ForestSensorReading): number {
    const tempScore = Math.max(0, Math.min(40, (reading.temperatureC - 15) * 1.5));
    const humidityScore = Math.max(0, Math.min(25, (80 - reading.humidityPct) * 0.4));
    const windScore = Math.max(0, Math.min(20, reading.windSpeedMs * 1.5));
    const drynessScore = Math.max(0, Math.min(15, reading.vegetationDryness * 15));
    return Math.round(tempScore + humidityScore + windScore + drynessScore);
  }

  private classifyRisk(score: number): RiskLevel {
    if (score >= 75) return 'critical';
    if (score >= 55) return 'warning';
    if (score >= 30) return 'caution';
    return 'safe';
  }

  // Plan SC: FR-R511.3
  assessRegion(region: string, grade: DataGrade = 'O'): WildfireRiskAssessment {
    blockClassifiedData(grade);
    const regionalReadings = Array.from(this.sensors.values()).filter(r => r.region === region);
    if (regionalReadings.length === 0) {
      throw new Error(`해당 지역 센서 데이터 없음: ${region}`);
    }

    let totalScore = 0;
    for (const reading of regionalReadings) {
      totalScore += this.computeRiskScore(reading);
    }
    const avgScore = Math.round(totalScore / regionalReadings.length);
    const level = this.classifyRisk(avgScore);
    const evacuationRecommended = level === 'critical';

    let recommendation: string;
    switch (level) {
      case 'critical':
        recommendation = '즉시 대피 권고 및 진화 자원 투입';
        break;
      case 'warning':
        recommendation = '경계 강화 및 인근 주민 안내';
        break;
      case 'caution':
        recommendation = '예방 순찰 강화';
        break;
      default:
        recommendation = '정상 모니터링 유지';
    }

    this.appendAudit('ASSESS_REGION', { region, riskScore: avgScore, level });
    return { region, riskScore: avgScore, riskLevel: level, evacuationRecommended, recommendation };
  }

  // Plan SC: FR-R511.4
  issueAlert(region: string, grade: DataGrade = 'O'): AlertRecord {
    blockClassifiedData(grade);
    const assessment = this.assessRegion(region, grade);
    const alert: AlertRecord = {
      region,
      level: assessment.riskLevel,
      riskScore: assessment.riskScore,
      issuedAt: new Date().toISOString(),
    };
    this.alerts.push(alert);
    this.appendAudit('ISSUE_ALERT', { region, level: alert.level });
    return alert;
  }

  getActiveAlerts(level?: RiskLevel): AlertRecord[] {
    if (level) return this.alerts.filter(a => a.level === level);
    return [...this.alerts];
  }

  // Plan SC: FR-R511.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
