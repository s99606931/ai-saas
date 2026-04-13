// Design Ref: §핵심 알고리즘 — 가중 거버넌스 점수 + 대시보드 요약
// Plan SC: FR-R293.1~5

enum DataGrade { C = 'C', S = 'S', O = 'O' }

interface DataAsset {
  id: string;
  name: string;
  type: string;
  owner: string;
  classification: string;
}

interface AssetMetrics {
  assetId: string;
  qualityScore: number;
  accessControlRate: number;
  metadataCompleteness: number;
  updatedAt: string;
}

interface GovernanceScore {
  assetId: string;
  assetName: string;
  governanceScore: number;
}

interface DashboardSummary {
  averageScore: number;
  topAssets: GovernanceScore[];
  bottomAssets: GovernanceScore[];
  totalAssets: number;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  details: Record<string, unknown>;
}

// Plan SC: FR-R293.5
function guardDataGrade(grade: DataGrade): void {
  if (grade === DataGrade.C || grade === DataGrade.S) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export class DataGovernanceDashboardAI {
  private assets = new Map<string, DataAsset>();
  private metrics = new Map<string, AssetMetrics>();
  private auditLog: AuditEntry[] = [];

  private log(action: string, details: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, details });
  }

  // Plan SC: FR-R293.1
  registerAsset(id: string, name: string, type: string, owner: string, classification: string): void {
    this.assets.set(id, { id, name, type, owner, classification });
    this.log('REGISTER_ASSET', { id, name, type, owner, classification });
  }

  // Plan SC: FR-R293.2
  updateMetrics(assetId: string, qualityScore: number, accessControlRate: number, metadataCompleteness: number, grade: DataGrade = DataGrade.O): void {
    guardDataGrade(grade);
    if (!this.assets.has(assetId)) throw new Error(`자산 미등록: ${assetId}`);
    this.metrics.set(assetId, { assetId, qualityScore, accessControlRate, metadataCompleteness, updatedAt: new Date().toISOString() });
    this.log('UPDATE_METRICS', { assetId, qualityScore, accessControlRate, metadataCompleteness });
  }

  // Plan SC: FR-R293.3
  calculateGovernanceScore(assetId: string): GovernanceScore {
    const asset = this.assets.get(assetId);
    if (!asset) throw new Error(`자산 미등록: ${assetId}`);
    const m = this.metrics.get(assetId);
    if (!m) return { assetId, assetName: asset.name, governanceScore: 0 };
    const score = Math.round(m.qualityScore * 0.4 + m.accessControlRate * 0.3 + m.metadataCompleteness * 0.3);
    return { assetId, assetName: asset.name, governanceScore: score };
  }

  // Plan SC: FR-R293.4
  getDashboardSummary(topN: number = 3): DashboardSummary {
    const scores = Array.from(this.assets.keys()).map(id => this.calculateGovernanceScore(id));
    const totalAssets = scores.length;
    const averageScore = totalAssets === 0 ? 0 : Math.round(scores.reduce((s, g) => s + g.governanceScore, 0) / totalAssets);
    const sorted = [...scores].sort((a, b) => b.governanceScore - a.governanceScore);
    this.log('GET_DASHBOARD_SUMMARY', { totalAssets, averageScore });
    return { averageScore, topAssets: sorted.slice(0, topN), bottomAssets: sorted.slice(-topN).reverse(), totalAssets };
  }

  // Plan SC: FR-R293.5
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
