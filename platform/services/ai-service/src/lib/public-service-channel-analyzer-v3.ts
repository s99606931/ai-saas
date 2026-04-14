// Design Ref: §채널점수 — completionRate×0.5+(satisfaction/5)×0.3+min(visits/10000,1)×0.2
// Plan SC: SC-R546-1, SC-R546-2, SC-R546-3

interface ChannelData {
  channelType: string;
  visitCount: number;
  completionRate: number;
  avgSatisfaction: number;
}

type ChannelGrade = 'EXCELLENT' | 'GOOD' | 'FAIR' | 'POOR';

interface ChannelAnalysisItem {
  channelType: string;
  score: number;
  grade: ChannelGrade;
}

interface ChannelAnalysisResult {
  agencyId: string;
  channels: ChannelAnalysisItem[];
  bestChannel: string;
  worstChannel: string;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  agencyId: string;
  bestChannel: string;
  worstChannel: string;
}

export class PublicServiceChannelAnalyzerV3 {
  private readonly auditLog: AuditEntry[] = [];

  analyze(agencyId: string, channels: ChannelData[]): ChannelAnalysisResult {
    const analyzed = channels.map((ch) => {
      const score = this.computeScore(ch);
      return { channelType: ch.channelType, score: Math.round(score * 1000) / 1000, grade: this.classifyGrade(score) };
    });

    const sorted = [...analyzed].sort((a, b) => b.score - a.score);
    const bestChannel = sorted.length > 0 ? sorted[0]!.channelType : '';
    const worstChannel = sorted.length > 0 ? sorted[sorted.length - 1]!.channelType : '';

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'CHANNEL_ANALYZED',
      agencyId,
      bestChannel,
      worstChannel,
    });

    return { agencyId, channels: analyzed, bestChannel, worstChannel };
  }

  private computeScore(ch: ChannelData): number {
    return ch.completionRate * 0.5 + (ch.avgSatisfaction / 5) * 0.3 + Math.min(ch.visitCount / 10000, 1) * 0.2;
  }

  private classifyGrade(score: number): ChannelGrade {
    if (score >= 0.8) return 'EXCELLENT';
    if (score >= 0.6) return 'GOOD';
    if (score >= 0.4) return 'FAIR';
    return 'POOR';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
