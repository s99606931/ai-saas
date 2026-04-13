// Design Ref: §도시 열섬 탐지 — 격자 기반 이상 온도 탐지 및 완화 권고
// Plan SC: FR-R551.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type LandUse = 'residential' | 'commercial' | 'industrial' | 'park' | 'water';

export interface GridCell {
  cellId: string;
  landUse: LandUse;
  surfaceTempC: number;
  ambientTempC: number;
  greenCoverageRate: number; // 0~1
  impervioussRate: number; // 0~1
  populationDensity: number;
}

export interface HeatIslandReport {
  cellId: string;
  intensity: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class UrbanHeatIslandDetector {
  private cells = new Map<string, GridCell>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R551.1
  registerCell(cell: GridCell, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (cell.greenCoverageRate < 0 || cell.greenCoverageRate > 1) {
      throw new Error('녹지 비율은 0~1 범위여야 합니다');
    }
    if (cell.impervioussRate < 0 || cell.impervioussRate > 1) {
      throw new Error('불투수 면적 비율은 0~1 범위여야 합니다');
    }
    if (cell.populationDensity < 0) throw new Error('인구 밀도는 0 이상이어야 합니다');
    this.cells.set(cell.cellId, { ...cell });
    this.append('REGISTER_CELL', { cellId: cell.cellId, landUse: cell.landUse });
  }

  // Plan SC: FR-R551.2
  computeIntensity(cellId: string, grade: DataGrade = 'O'): number {
    blockClassifiedData(grade);
    const cell = this.cells.get(cellId);
    if (!cell) throw new Error(`격자 미등록: ${cellId}`);
    const delta = cell.surfaceTempC - cell.ambientTempC;
    const intensity = Math.round(delta * 100) / 100;
    this.append('COMPUTE_INTENSITY', { cellId, intensity });
    return intensity;
  }

  // Plan SC: FR-R551.3
  analyze(cellId: string, grade: DataGrade = 'O'): HeatIslandReport {
    blockClassifiedData(grade);
    const cell = this.cells.get(cellId);
    if (!cell) throw new Error(`격자 미등록: ${cellId}`);
    const intensity = cell.surfaceTempC - cell.ambientTempC;
    const riskLevel: HeatIslandReport['riskLevel'] =
      intensity >= 6 ? 'critical' : intensity >= 4 ? 'high' : intensity >= 2 ? 'medium' : 'low';

    const recommendations: string[] = [];
    if (cell.greenCoverageRate < 0.2) recommendations.push('녹지 면적 확대 (최소 20% 권고)');
    if (cell.impervioussRate > 0.7) recommendations.push('투수성 포장재 전환 검토');
    if (riskLevel === 'critical' || riskLevel === 'high') {
      recommendations.push('쿨링 센터 설치 검토');
      if (cell.populationDensity > 10000) recommendations.push('취약계층 방문 돌봄 강화');
    }
    if (cell.landUse === 'industrial' && intensity > 3) {
      recommendations.push('산업 냉각시설 배출열 저감 권고');
    }

    const report: HeatIslandReport = {
      cellId,
      intensity: Math.round(intensity * 100) / 100,
      riskLevel,
      recommendations,
    };
    this.append('ANALYZE', { cellId, riskLevel });
    return report;
  }

  // Plan SC: FR-R551.4
  rankHotspots(topN = 5): HeatIslandReport[] {
    const reports = Array.from(this.cells.keys()).map(id => this.analyze(id));
    return reports.sort((a, b) => b.intensity - a.intensity).slice(0, Math.max(0, topN));
  }

  // Plan SC: FR-R551.5
  listCells(landUse?: LandUse): GridCell[] {
    const all = Array.from(this.cells.values());
    return (landUse ? all.filter(c => c.landUse === landUse) : all).map(c => ({ ...c }));
  }

  // Plan SC: FR-R551.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
