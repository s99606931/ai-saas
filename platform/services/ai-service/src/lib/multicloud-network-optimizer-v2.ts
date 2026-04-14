// Design Ref: §링크점수 — (1-min(lat/1000,1))×0.5+(1-min(cost/10,1))×0.3+min(bw/1000,1)×0.2
// Plan SC: SC-R572-1, SC-R572-2, SC-R572-3

interface NetworkLink {
  from: string;
  to: string;
  latencyMs: number;
  costPerGB: number;
  bandwidthMbps: number;
}

type LinkStatus = 'OPTIMAL' | 'ACCEPTABLE' | 'BOTTLENECK';

interface LinkResult {
  from: string;
  to: string;
  score: number;
  status: LinkStatus;
}

interface NetworkOptResult {
  networkId: string;
  links: LinkResult[];
  bestLink: { from: string; to: string };
  bottlenecks: { from: string; to: string }[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  networkId: string;
  bottleneckCount: number;
}

export class MulticloudNetworkOptimizerV2 {
  private readonly auditLog: AuditEntry[] = [];

  optimize(networkId: string, links: NetworkLink[]): NetworkOptResult {
    const scored: LinkResult[] = links.map((link) => ({
      from: link.from,
      to: link.to,
      score: this.computeScore(link),
      status: this.classifyStatus(this.computeScore(link)),
    }));

    const sorted = [...scored].sort((a, b) => b.score - a.score);
    const bestLink = sorted.length > 0
      ? { from: sorted[0]!.from, to: sorted[0]!.to }
      : { from: '', to: '' };
    const bottlenecks = scored
      .filter((l) => l.status === 'BOTTLENECK')
      .map((l) => ({ from: l.from, to: l.to }));

    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'NETWORK_OPTIMIZED',
      networkId,
      bottleneckCount: bottlenecks.length,
    });

    return {
      networkId,
      links: scored.map((l) => ({ ...l, score: Math.round(l.score * 1000) / 1000 })),
      bestLink,
      bottlenecks,
    };
  }

  private computeScore(link: NetworkLink): number {
    return (
      (1 - Math.min(link.latencyMs / 1000, 1)) * 0.5 +
      (1 - Math.min(link.costPerGB / 10, 1)) * 0.3 +
      Math.min(link.bandwidthMbps / 1000, 1) * 0.2
    );
  }

  private classifyStatus(score: number): LinkStatus {
    if (score >= 0.7) return 'OPTIMAL';
    if (score >= 0.4) return 'ACCEPTABLE';
    return 'BOTTLENECK';
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
