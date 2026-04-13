// Design Ref: §AI 공공 와이파이 최적화 — AP 부하 분산 및 채널 선택
// Plan SC: FR-R599.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface AccessPoint {
  apId: string;
  location: string;
  band: '2.4GHz' | '5GHz' | 'dual';
  maxClients: number;
  currentClients: number;
  channel: number;
  signalStrength: number; // dBm (-30~-90)
  throughputMbps: number;
}

export interface InterferenceReport {
  apId: string;
  neighborChannels: number[]; // 주변 AP 사용 채널
  noiseFloor: number; // dBm
}

export interface OptimizationPlan {
  apId: string;
  action: 'offload' | 'rechannel' | 'boost-power' | 'maintain';
  recommendedChannel: number;
  reason: string;
  loadRatio: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

const VALID_CHANNELS_24 = [1, 6, 11];
const VALID_CHANNELS_5 = [36, 40, 44, 48, 149, 153, 157, 161];

export class AIPublicWiFiOptimizer {
  private readonly audit: AuditEntry[] = [];
  private readonly aps = new Map<string, AccessPoint>();
  private readonly interference = new Map<string, InterferenceReport>();

  private log(action: string, detail: Record<string, unknown>): void {
    this.audit.push({ timestamp: new Date().toISOString(), action, detail });
  }

  registerAP(ap: AccessPoint, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (ap.maxClients <= 0) throw new Error('maxClients 양수');
    if (ap.currentClients < 0) throw new Error('currentClients 음수 불가');
    this.aps.set(ap.apId, ap);
    this.log('REGISTER_AP', { apId: ap.apId });
  }

  reportInterference(report: InterferenceReport, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    this.interference.set(report.apId, report);
    this.log('INTERFERENCE', { apId: report.apId });
  }

  private pickBestChannel(band: AccessPoint['band'], neighbors: number[]): number {
    const candidates = band === '2.4GHz' ? VALID_CHANNELS_24 : VALID_CHANNELS_5;
    let best = candidates[0]!;
    let bestCount = Infinity;
    for (const ch of candidates) {
      const count = neighbors.filter((n) => Math.abs(n - ch) <= 4).length;
      if (count < bestCount) {
        best = ch;
        bestCount = count;
      }
    }
    return best;
  }

  optimize(grade: DataGrade = 'O'): OptimizationPlan[] {
    blockClassifiedData(grade);
    const plans: OptimizationPlan[] = [];
    for (const ap of this.aps.values()) {
      const loadRatio = ap.currentClients / ap.maxClients;
      const intf = this.interference.get(ap.apId);
      const reasons: string[] = [];
      let action: OptimizationPlan['action'] = 'maintain';
      let recommendedChannel = ap.channel;

      if (loadRatio >= 0.9) {
        action = 'offload';
        reasons.push(`부하 ${(loadRatio * 100).toFixed(0)}%`);
      } else if (intf && intf.neighborChannels.some((n) => Math.abs(n - ap.channel) <= 2)) {
        action = 'rechannel';
        const band: AccessPoint['band'] = ap.band === 'dual' ? '5GHz' : ap.band;
        recommendedChannel = this.pickBestChannel(band, intf.neighborChannels);
        reasons.push(`간섭 회피 → ch${recommendedChannel}`);
      } else if (ap.signalStrength < -75) {
        action = 'boost-power';
        reasons.push(`신호 ${ap.signalStrength}dBm`);
      } else {
        reasons.push('정상');
      }

      plans.push({
        apId: ap.apId,
        action,
        recommendedChannel,
        reason: reasons.join(', '),
        loadRatio,
      });
    }
    const order: Record<OptimizationPlan['action'], number> = {
      offload: 0,
      rechannel: 1,
      'boost-power': 2,
      maintain: 3,
    };
    plans.sort((a, b) => order[a.action] - order[b.action]);
    this.log('OPTIMIZE', { count: plans.length });
    return plans;
  }

  getAuditLog(): AuditEntry[] {
    return [...this.audit];
  }
}
