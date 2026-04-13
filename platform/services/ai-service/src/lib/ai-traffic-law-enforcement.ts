// Design Ref: §AI 교통법규 단속 지원 — 위반 유형 판정 + 과태료 산정
// Plan SC: FR-R595.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type ViolationType =
  | 'speeding'
  | 'signal'
  | 'illegal-parking'
  | 'bus-lane'
  | 'seatbelt'
  | 'phone'
  | 'crosswalk';

export type VehicleClass = 'bike' | 'car' | 'van' | 'truck' | 'bus';

export interface ViolationEvent {
  eventId: string;
  timestamp: string;
  type: ViolationType;
  vehicleClass: VehicleClass;
  speedLimit?: number;
  actualSpeed?: number;
  schoolZone: boolean;
}

export interface EnforcementResult {
  eventId: string;
  type: ViolationType;
  fine: number; // KRW
  demeritPoints: number;
  reviewRequired: boolean;
  reason: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const BASE_FINES: Record<ViolationType, number> = {
  speeding: 30000,
  signal: 60000,
  'illegal-parking': 40000,
  'bus-lane': 50000,
  seatbelt: 30000,
  phone: 60000,
  crosswalk: 60000,
};

const BASE_POINTS: Record<ViolationType, number> = {
  speeding: 15,
  signal: 15,
  'illegal-parking': 0,
  'bus-lane': 10,
  seatbelt: 0,
  phone: 15,
  crosswalk: 10,
};

export class AITrafficLawEnforcement {
  private readonly audit: AuditEntry[] = [];

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  enforce(event: ViolationEvent, grade: DataGrade = 'O'): EnforcementResult {
    blockClassifiedData(grade);
    const baseFine = BASE_FINES[event.type];
    const basePoints = BASE_POINTS[event.type];
    let fine = baseFine;
    let points = basePoints;
    let reviewRequired = false;
    const reasons: string[] = [`기본 ${event.type}`];

    // 스쿨존 가중 2배
    if (event.schoolZone) {
      fine *= 2;
      points *= 2;
      reasons.push('스쿨존 2배');
    }

    // 속도위반 초과량별 가중
    if (event.type === 'speeding' && event.speedLimit !== undefined && event.actualSpeed !== undefined) {
      const over = event.actualSpeed - event.speedLimit;
      if (over < 0) {
        throw new Error('actualSpeed가 speedLimit 이하 — 위반 아님');
      }
      if (over >= 60) {
        fine += 70000;
        points += 45;
        reasons.push('60km/h 초과');
        reviewRequired = true;
      } else if (over >= 40) {
        fine += 40000;
        points += 30;
        reasons.push('40km/h 초과');
      } else if (over >= 20) {
        fine += 20000;
        points += 15;
        reasons.push('20km/h 초과');
      }
    }

    // 대형차량 가중
    if (event.vehicleClass === 'truck' || event.vehicleClass === 'bus') {
      fine += 10000;
      reasons.push('대형차량');
    }

    // 검토 필요 조건
    if (points >= 40) reviewRequired = true;

    const result: EnforcementResult = {
      eventId: event.eventId,
      type: event.type,
      fine,
      demeritPoints: points,
      reviewRequired,
      reason: reasons.join(', '),
    };
    this.log('ENFORCE', { eventId: event.eventId, fine, points });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
