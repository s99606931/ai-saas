// Design Ref: §AI 공공 공원 방문자 카운터 — 센서 기반 방문자 수 추정 및 혼잡도 예측
// Plan SC: FR-R593.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface ParkZone {
  zoneId: string;
  parkName: string;
  capacity: number;
  area: number; // m2
}

export interface GateEvent {
  zoneId: string;
  timestamp: string;
  entries: number;
  exits: number;
}

export type CrowdLevel = 'empty' | 'normal' | 'busy' | 'congested' | 'overflow';

export interface VisitorEstimate {
  zoneId: string;
  currentVisitors: number;
  crowdLevel: CrowdLevel;
  utilizationRate: number; // 0~1+
  recommendation: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

export class AIPublicParkVisitorCounter {
  private readonly audit: AuditEntry[] = [];
  private readonly zones = new Map<string, ParkZone>();
  private readonly events = new Map<string, GateEvent[]>();

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  registerZone(zone: ParkZone, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (zone.capacity <= 0) throw new Error('capacity는 양수');
    this.zones.set(zone.zoneId, zone);
    this.log('REGISTER_ZONE', { zoneId: zone.zoneId });
  }

  recordGate(event: GateEvent, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (event.entries < 0 || event.exits < 0) throw new Error('음수 불가');
    const arr = this.events.get(event.zoneId) ?? [];
    arr.push(event);
    this.events.set(event.zoneId, arr);
    this.log('GATE', { zoneId: event.zoneId });
  }

  estimate(zoneId: string, grade: DataGrade = 'O'): VisitorEstimate {
    blockClassifiedData(grade);
    const zone = this.zones.get(zoneId);
    if (!zone) throw new Error(`zone 없음: ${zoneId}`);
    const arr = this.events.get(zoneId) ?? [];
    let current = 0;
    for (const ev of arr) {
      current += ev.entries - ev.exits;
    }
    current = Math.max(0, current);

    const util = current / zone.capacity;
    let crowdLevel: CrowdLevel;
    if (util < 0.1) crowdLevel = 'empty';
    else if (util < 0.5) crowdLevel = 'normal';
    else if (util < 0.75) crowdLevel = 'busy';
    else if (util < 1.0) crowdLevel = 'congested';
    else crowdLevel = 'overflow';

    let recommendation: string;
    switch (crowdLevel) {
      case 'empty': recommendation = '이용 권장'; break;
      case 'normal': recommendation = '쾌적'; break;
      case 'busy': recommendation = '적정'; break;
      case 'congested': recommendation = '대기 필요'; break;
      case 'overflow': recommendation = '입장 제한 권고'; break;
    }

    const result: VisitorEstimate = {
      zoneId,
      currentVisitors: current,
      crowdLevel,
      utilizationRate: util,
      recommendation,
    };
    this.log('ESTIMATE', { zoneId, current, crowdLevel });
    return result;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
