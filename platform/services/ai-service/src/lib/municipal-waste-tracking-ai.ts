// Design Ref: §도시 폐기물 추적 AI — 수거 경로 최적화 + 분리수거율 분석
// Plan SC: FR-R594.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type WasteType = 'general' | 'recycle' | 'food' | 'large' | 'hazardous';

export interface WasteBin {
  binId: string;
  district: string;
  capacity: number; // kg
  wasteType: WasteType;
}

export interface WasteReport {
  binId: string;
  timestamp: string;
  fillLevel: number; // 0~1
  contaminationRate: number; // 0~1 (분리수거 오염율)
}

export interface CollectionPlan {
  binId: string;
  district: string;
  priority: 'now' | 'today' | 'tomorrow' | 'this-week';
  estimatedWeight: number;
  contaminated: boolean;
}

export interface RecyclingStats {
  district: string;
  totalBins: number;
  averageContamination: number;
  recycleRate: number; // 일반 대비 분리수거 비율
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class MunicipalWasteTrackingAI {
  private readonly audit: AuditEntry[] = [];
  private readonly bins = new Map<string, WasteBin>();
  private readonly reports = new Map<string, WasteReport[]>();

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  registerBin(bin: WasteBin, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (bin.capacity <= 0) throw new Error('capacity 양수');
    this.bins.set(bin.binId, bin);
    this.log('REGISTER_BIN', { binId: bin.binId });
  }

  report(report: WasteReport, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (report.fillLevel < 0 || report.fillLevel > 1) throw new Error('fillLevel 0~1');
    if (report.contaminationRate < 0 || report.contaminationRate > 1) throw new Error('contaminationRate 0~1');
    const arr = this.reports.get(report.binId) ?? [];
    arr.push(report);
    this.reports.set(report.binId, arr);
    this.log('REPORT', { binId: report.binId });
  }

  planCollection(grade: DataGrade = 'O'): CollectionPlan[] {
    blockClassifiedData(grade);
    const plans: CollectionPlan[] = [];
    for (const bin of this.bins.values()) {
      const arr = this.reports.get(bin.binId) ?? [];
      const last = arr.length > 0 ? arr[arr.length - 1]! : null;
      const fill = last?.fillLevel ?? 0;
      const contam = last?.contaminationRate ?? 0;

      let priority: CollectionPlan['priority'];
      if (fill >= 0.9 || bin.wasteType === 'hazardous') priority = 'now';
      else if (fill >= 0.7) priority = 'today';
      else if (fill >= 0.5) priority = 'tomorrow';
      else priority = 'this-week';

      plans.push({
        binId: bin.binId,
        district: bin.district,
        priority,
        estimatedWeight: Math.round(bin.capacity * fill),
        contaminated: contam > 0.3,
      });
    }
    const order: Record<CollectionPlan['priority'], number> = { now: 0, today: 1, tomorrow: 2, 'this-week': 3 };
    plans.sort((a, b) => order[a.priority] - order[b.priority]);
    this.log('PLAN', { count: plans.length });
    return plans;
  }

  statsByDistrict(district: string, grade: DataGrade = 'O'): RecyclingStats {
    blockClassifiedData(grade);
    const districtBins = [...this.bins.values()].filter((b) => b.district === district);
    if (districtBins.length === 0) {
      return { district, totalBins: 0, averageContamination: 0, recycleRate: 0 };
    }
    let contamSum = 0;
    let contamCount = 0;
    let recycleBins = 0;
    for (const bin of districtBins) {
      if (bin.wasteType === 'recycle') recycleBins++;
      const arr = this.reports.get(bin.binId) ?? [];
      for (const r of arr) {
        contamSum += r.contaminationRate;
        contamCount++;
      }
    }
    const averageContamination = contamCount > 0 ? contamSum / contamCount : 0;
    const recycleRate = recycleBins / districtBins.length;
    return {
      district,
      totalBins: districtBins.length,
      averageContamination,
      recycleRate,
    };
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
