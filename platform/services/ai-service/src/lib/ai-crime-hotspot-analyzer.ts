// Design Ref: §범죄 핫스팟 분석 — 공간 클러스터링 및 위험도 점수
// Plan SC: FR-R605.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type CrimeCategory = 'theft' | 'assault' | 'fraud' | 'vandalism' | 'drug';

export interface CrimeIncident {
  incidentId: string;
  category: CrimeCategory;
  gridX: number;
  gridY: number;
  severity: number; // 1~10
  timestamp: string;
}

export interface Hotspot {
  gridX: number;
  gridY: number;
  incidentCount: number;
  riskScore: number;
  dominantCategory: CrimeCategory;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AICrimeHotspotAnalyzer {
  private incidents: CrimeIncident[] = [];
  private auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R605.1
  recordIncident(incident: CrimeIncident, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (incident.severity < 1 || incident.severity > 10) {
      throw new Error('심각도는 1~10 범위여야 합니다');
    }
    if (!Number.isFinite(incident.gridX) || !Number.isFinite(incident.gridY)) {
      throw new Error('좌표가 유효하지 않습니다');
    }
    this.incidents.push({ ...incident });
    this.append('RECORD_INCIDENT', { incidentId: incident.incidentId, category: incident.category });
  }

  // Plan SC: FR-R605.2
  analyzeHotspots(minIncidents = 3): Hotspot[] {
    const groups = new Map<string, CrimeIncident[]>();
    for (const inc of this.incidents) {
      const key = `${inc.gridX}_${inc.gridY}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(inc);
    }

    const hotspots: Hotspot[] = [];
    for (const [key, list] of groups.entries()) {
      if (list.length < minIncidents) continue;
      const parts = key.split('_');
      const gridX = Number(parts[0]);
      const gridY = Number(parts[1]);

      const severitySum = list.reduce((a, b) => a + b.severity, 0);
      const riskScore = Math.round((severitySum * list.length) / 2 * 100) / 100;

      const categoryCount = new Map<CrimeCategory, number>();
      for (const inc of list) {
        categoryCount.set(inc.category, (categoryCount.get(inc.category) ?? 0) + 1);
      }
      let dominant: CrimeCategory = list[0]!.category;
      let maxCount = 0;
      for (const [cat, cnt] of categoryCount.entries()) {
        if (cnt > maxCount) {
          maxCount = cnt;
          dominant = cat;
        }
      }

      hotspots.push({
        gridX,
        gridY,
        incidentCount: list.length,
        riskScore,
        dominantCategory: dominant,
      });
    }
    hotspots.sort((a, b) => b.riskScore - a.riskScore);
    return hotspots;
  }

  // Plan SC: FR-R605.3
  countByCategory(): Record<CrimeCategory, number> {
    const counts: Record<CrimeCategory, number> = {
      theft: 0,
      assault: 0,
      fraud: 0,
      vandalism: 0,
      drug: 0,
    };
    for (const inc of this.incidents) counts[inc.category]++;
    return counts;
  }

  // Plan SC: FR-R605.4
  incidentsInArea(gridX: number, gridY: number): CrimeIncident[] {
    return this.incidents.filter(i => i.gridX === gridX && i.gridY === gridY).map(i => ({ ...i }));
  }

  // Plan SC: FR-R605.5
  totalIncidents(): number {
    return this.incidents.length;
  }

  // Plan SC: FR-R605.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
