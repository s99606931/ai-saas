/**
 * 고급 보안 파사드 (MTU-N479~N482)
 * Design Ref: MTU-N479~N482
 * Plan SC: FR-0D.*, FR-SC.*, FR-RW.*, FR-IT.*
 */

// ============ MTU-N479: Zero-day Detector ============

export interface BehaviorSample {
  entityId: string;
  timestamp: string;
  features: Record<string, number>;
}

export class BehaviorBaseline {
  private means = new Map<string, Record<string, number>>();
  private counts = new Map<string, number>();

  train(samples: BehaviorSample[]): void {
    for (const sample of samples) {
      const existing = this.means.get(sample.entityId) ?? {};
      const count = this.counts.get(sample.entityId) ?? 0;
      const newCount = count + 1;
      const updated: Record<string, number> = { ...existing };
      for (const [key, value] of Object.entries(sample.features)) {
        const prev = updated[key] ?? 0;
        updated[key] = (prev * count + value) / newCount;
      }
      this.means.set(sample.entityId, updated);
      this.counts.set(sample.entityId, newCount);
    }
  }

  /**
   * 편차 점수 (z-score 근사)
   */
  anomalyScore(sample: BehaviorSample): number {
    const mean = this.means.get(sample.entityId);
    if (!mean) return 0;
    let score = 0;
    let count = 0;
    for (const [key, value] of Object.entries(sample.features)) {
      const m = mean[key] ?? 0;
      if (m !== 0) {
        score += Math.abs((value - m) / m);
        count++;
      }
    }
    return count > 0 ? score / count : 0;
  }
}

export type ThreatSeverity = 'info' | 'low' | 'medium' | 'high' | 'critical';

export interface ThreatIncident {
  incidentId: string;
  entityId: string;
  severity: ThreatSeverity;
  type: string;
  detectedAt: string;
  isolated: boolean;
}

export class ZeroDayDetector {
  constructor(private baseline: BehaviorBaseline) {}

  detect(sample: BehaviorSample): ThreatIncident | null {
    const score = this.baseline.anomalyScore(sample);
    if (score < 1.5) return null;

    let severity: ThreatSeverity = 'low';
    if (score >= 5) severity = 'critical';
    else if (score >= 3) severity = 'high';
    else if (score >= 2) severity = 'medium';

    return {
      incidentId: `zd-${Date.now()}-${sample.entityId}`,
      entityId: sample.entityId,
      severity,
      type: 'anomalous-behavior',
      detectedAt: new Date().toISOString(),
      isolated: severity === 'critical',
    };
  }
}

// ============ MTU-N480: Supply Chain ============

export interface DependencyNode {
  packageName: string;
  version: string;
  publisher: string;
  trustScore: number; // 0-100
  lastUpdated: string;
}

export class SupplyChainMonitor {
  private nodes = new Map<string, DependencyNode>();
  private history = new Map<string, DependencyNode[]>();

  register(node: DependencyNode): void {
    const key = `${node.packageName}@${node.version}`;
    this.nodes.set(key, node);
    const hist = this.history.get(node.packageName) ?? [];
    hist.push({ ...node });
    this.history.set(node.packageName, hist);
  }

  /**
   * 이상 업데이트 탐지: 신뢰도 급락 또는 발행자 변경
   */
  detectAnomaly(packageName: string): string[] {
    const hist = this.history.get(packageName) ?? [];
    if (hist.length < 2) return [];
    const anomalies: string[] = [];
    const prev = hist[hist.length - 2];
    const curr = hist[hist.length - 1];
    if (!prev || !curr) return [];
    if (curr.publisher !== prev.publisher) {
      anomalies.push(`발행자 변경: ${prev.publisher} → ${curr.publisher}`);
    }
    if (curr.trustScore < prev.trustScore - 20) {
      anomalies.push(`신뢰도 급락: ${prev.trustScore} → ${curr.trustScore}`);
    }
    return anomalies;
  }
}

// ============ MTU-N481: Ransomware Detector ============

export interface FileSystemEvent {
  path: string;
  operation: 'read' | 'write' | 'delete' | 'rename';
  processId: string;
  timestamp: string;
}

export class RansomwareDetector {
  /**
   * 랜섬웨어 패턴: 대량 쓰기 + 확장자 변경 빈발
   */
  analyze(events: FileSystemEvent[], windowMs = 60000): {
    suspiciousProcesses: string[];
    writeRate: Map<string, number>;
  } {
    const writeRate = new Map<string, number>();
    const renameCount = new Map<string, number>();
    const now = Date.now();

    for (const event of events) {
      const eventTime = new Date(event.timestamp).getTime();
      if (now - eventTime > windowMs) continue;

      if (event.operation === 'write') {
        writeRate.set(event.processId, (writeRate.get(event.processId) ?? 0) + 1);
      }
      if (event.operation === 'rename') {
        renameCount.set(event.processId, (renameCount.get(event.processId) ?? 0) + 1);
      }
    }

    const suspicious: string[] = [];
    for (const [pid, writes] of writeRate) {
      const renames = renameCount.get(pid) ?? 0;
      // 1분에 50개 이상 쓰기 + 10개 이상 이름 변경 → 의심
      if (writes > 50 && renames > 10) {
        suspicious.push(pid);
      }
    }

    return { suspiciousProcesses: suspicious, writeRate };
  }
}

// ============ MTU-N482: Insider Threat (UEBA) ============

export interface UserActivity {
  userId: string;
  timestamp: string;
  action: string;
  resource: string;
  bytesTransferred?: number;
}

export class UserBehaviorAnalytics {
  private baseline = new Map<string, { actionCounts: Map<string, number>; avgBytes: number }>();

  train(activities: UserActivity[]): void {
    for (const activity of activities) {
      const existing = this.baseline.get(activity.userId) ?? {
        actionCounts: new Map<string, number>(),
        avgBytes: 0,
      };
      existing.actionCounts.set(
        activity.action,
        (existing.actionCounts.get(activity.action) ?? 0) + 1,
      );
      if (activity.bytesTransferred !== undefined) {
        existing.avgBytes = (existing.avgBytes + activity.bytesTransferred) / 2;
      }
      this.baseline.set(activity.userId, existing);
    }
  }

  /**
   * 비정상 행동 점수
   */
  assessRisk(activity: UserActivity): {
    userId: string;
    riskScore: number;
    reasons: string[];
  } {
    const base = this.baseline.get(activity.userId);
    const reasons: string[] = [];
    let score = 0;

    if (!base) {
      return { userId: activity.userId, riskScore: 50, reasons: ['베이스라인 없음'] };
    }

    const actionCount = base.actionCounts.get(activity.action) ?? 0;
    if (actionCount === 0) {
      reasons.push(`신규 액션: ${activity.action}`);
      score += 30;
    }

    if (activity.bytesTransferred !== undefined && base.avgBytes > 0) {
      const ratio = activity.bytesTransferred / base.avgBytes;
      if (ratio > 10) {
        reasons.push(`대용량 전송 (평균의 ${ratio.toFixed(1)}배)`);
        score += 40;
      }
    }

    // 업무 외 시간 (23:00~06:00)
    const hour = new Date(activity.timestamp).getHours();
    if (hour >= 23 || hour < 6) {
      reasons.push('업무 외 시간 활동');
      score += 15;
    }

    return { userId: activity.userId, riskScore: Math.min(100, score), reasons };
  }
}
