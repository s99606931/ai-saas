// Design Ref: §스마트 주차 수익 AI — 동적 요금/점유율 수익 극대화
// Plan SC: FR-R564.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface ParkingLot {
  lotId: string;
  capacity: number;
  baseRatePerHour: number;
  currentOccupancy: number;
  peakHours: number[]; // 0~23
}

export interface DynamicRate {
  lotId: string;
  hour: number;
  rate: number;
  occupancyRate: number;
  reason: string;
}

export interface RevenueReport {
  lotId: string;
  totalRevenue: number;
  averageOccupancy: number;
  peakRevenue: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class SmartParkingRevenueAI {
  private readonly lots = new Map<string, ParkingLot>();
  private readonly rateHistory: DynamicRate[] = [];
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R564.1
  registerLot(lot: ParkingLot, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (lot.capacity <= 0) throw new Error('용량은 0보다 커야 합니다');
    if (lot.baseRatePerHour < 0) throw new Error('기본 요금은 0 이상이어야 합니다');
    if (lot.currentOccupancy < 0 || lot.currentOccupancy > lot.capacity) {
      throw new Error('현재 점유 수는 0~용량 사이여야 합니다');
    }
    for (const h of lot.peakHours) {
      if (h < 0 || h > 23) throw new Error('피크 시간은 0~23 이어야 합니다');
    }
    this.lots.set(lot.lotId, { ...lot, peakHours: [...lot.peakHours] });
    this.append('REGISTER_LOT', { lotId: lot.lotId });
  }

  // Plan SC: FR-R564.2
  computeDynamicRate(lotId: string, hour: number, grade: DataGrade = 'O'): DynamicRate {
    blockClassifiedData(grade);
    if (hour < 0 || hour > 23) throw new Error('시간은 0~23 범위여야 합니다');
    const lot = this.lots.get(lotId);
    if (!lot) throw new Error(`주차장 미등록: ${lotId}`);

    const occupancyRate = lot.currentOccupancy / lot.capacity;
    let multiplier = 1;
    const reasons: string[] = [];

    if (lot.peakHours.includes(hour)) {
      multiplier *= 1.5;
      reasons.push('피크시간 50% 할증');
    }
    if (occupancyRate >= 0.9) {
      multiplier *= 1.3;
      reasons.push('포화 임박 30% 할증');
    } else if (occupancyRate >= 0.7) {
      multiplier *= 1.15;
      reasons.push('높은 점유율 15% 할증');
    } else if (occupancyRate < 0.3) {
      multiplier *= 0.85;
      reasons.push('저점유 15% 할인');
    }

    const rate = Math.round(lot.baseRatePerHour * multiplier * 100) / 100;
    const result: DynamicRate = {
      lotId,
      hour,
      rate,
      occupancyRate: Math.round(occupancyRate * 1000) / 1000,
      reason: reasons.join(', ') || '기본 요금',
    };
    this.rateHistory.push(result);
    this.append('COMPUTE_RATE', { lotId, hour, rate });
    return result;
  }

  // Plan SC: FR-R564.3
  forecastRevenue(lotId: string, hours: number[]): RevenueReport {
    const lot = this.lots.get(lotId);
    if (!lot) throw new Error(`주차장 미등록: ${lotId}`);
    if (hours.length === 0) throw new Error('예측할 시간 배열이 비어있습니다');

    let total = 0;
    let peak = 0;
    for (const h of hours) {
      const rate = this.computeDynamicRate(lotId, h);
      const hourRevenue = rate.rate * lot.currentOccupancy;
      total += hourRevenue;
      if (lot.peakHours.includes(h)) peak += hourRevenue;
    }
    const report: RevenueReport = {
      lotId,
      totalRevenue: Math.round(total * 100) / 100,
      averageOccupancy: Math.round((lot.currentOccupancy / lot.capacity) * 1000) / 1000,
      peakRevenue: Math.round(peak * 100) / 100,
    };
    this.append('FORECAST', { lotId, total });
    return report;
  }

  // Plan SC: FR-R564.4
  updateOccupancy(lotId: string, occupancy: number): void {
    const lot = this.lots.get(lotId);
    if (!lot) throw new Error(`주차장 미등록: ${lotId}`);
    if (occupancy < 0 || occupancy > lot.capacity) {
      throw new Error('점유 수는 0~용량 사이여야 합니다');
    }
    lot.currentOccupancy = occupancy;
    this.append('UPDATE_OCCUPANCY', { lotId, occupancy });
  }

  // Plan SC: FR-R564.5
  listRateHistory(): DynamicRate[] {
    return [...this.rateHistory];
  }

  // Plan SC: FR-R564.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
