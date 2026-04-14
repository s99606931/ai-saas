// Design Ref: §R558 — AI기반 공공 민원 트렌드 분석 v2
// Plan SC: SVC-AI-ADV-R558-SC01

export type ComplaintStatus = 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED'
export type ComplaintPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'

export interface Complaint {
  complaintId: string
  category: string
  subCategory: string
  submittedAt: string   // ISO 날짜 (YYYY-MM-DD)
  resolvedAt: string | null
  status: ComplaintStatus
  priority: ComplaintPriority
  resolutionDays: number | null
}

export interface TrendPeriod {
  period: string    // 'YYYY-MM' 형식
  count: number
  resolvedCount: number
  avgResolutionDays: number
  growthRatePct: number   // 전 기간 대비 증가율
}

export interface CategoryTrend {
  category: string
  totalCount: number
  unresolvedCount: number
  avgResolutionDays: number
  priorityDistribution: Record<ComplaintPriority, number>
}

export interface ComplaintTrendReport {
  totalComplaints: number
  unresolvedCount: number
  periodTrends: TrendPeriod[]
  topCategories: CategoryTrend[]
  recommendations: string[]
  generatedAt: string
}

interface AuditEntry {
  timestamp: string
  action: string
  complaintId: string
  detail: Record<string, unknown>
}

export class ComplaintTrendAnalyzerV2 {
  private complaints: Complaint[] = []
  private auditLog: AuditEntry[] = []

  registerComplaint(complaint: Complaint): void {
    this.complaints.push(complaint)
    this.appendAudit('complaint.register', complaint.complaintId, { category: complaint.category, status: complaint.status })
  }

  analyzeTrend(period: 'MONTHLY' | 'QUARTERLY'): TrendPeriod[] {
    this.appendAudit('trend.analyze', 'system', { period, totalComplaints: this.complaints.length })

    const grouped = new Map<string, Complaint[]>()
    for (const c of this.complaints) {
      const key = period === 'MONTHLY'
        ? c.submittedAt.slice(0, 7)        // YYYY-MM
        : `${c.submittedAt.slice(0, 4)}-Q${Math.ceil(parseInt(c.submittedAt.slice(5, 7)) / 3)}`
      const group = grouped.get(key) ?? []
      group.push(c)
      grouped.set(key, group)
    }

    const sortedKeys = Array.from(grouped.keys()).sort()
    return sortedKeys.map((key, idx) => {
      const items = grouped.get(key) ?? []
      const resolved = items.filter((c) => c.resolutionDays !== null)
      const avgResolutionDays = resolved.length > 0
        ? resolved.reduce((s, c) => s + (c.resolutionDays ?? 0), 0) / resolved.length
        : 0

      const prevKey = idx > 0 ? sortedKeys[idx - 1] : undefined
      const prevCount = prevKey !== undefined ? (grouped.get(prevKey) ?? []).length : 0
      const growthRatePct = prevCount > 0
        ? Math.round(((items.length - prevCount) / prevCount) * 100)
        : 0

      return {
        period: key,
        count: items.length,
        resolvedCount: resolved.length,
        avgResolutionDays: Math.round(avgResolutionDays),
        growthRatePct,
      }
    })
  }

  getTopCategories(limit = 5): CategoryTrend[] {
    const grouped = new Map<string, Complaint[]>()
    for (const c of this.complaints) {
      const group = grouped.get(c.category) ?? []
      group.push(c)
      grouped.set(c.category, group)
    }

    return Array.from(grouped.entries())
      .map(([category, items]) => {
        const resolved = items.filter((c) => c.resolutionDays !== null)
        const avgResolutionDays = resolved.length > 0
          ? resolved.reduce((s, c) => s + (c.resolutionDays ?? 0), 0) / resolved.length
          : 0
        const priorityDistribution: Record<ComplaintPriority, number> = { LOW: 0, MEDIUM: 0, HIGH: 0, URGENT: 0 }
        for (const c of items) {
          priorityDistribution[c.priority] = (priorityDistribution[c.priority] ?? 0) + 1
        }
        return {
          category,
          totalCount: items.length,
          unresolvedCount: items.filter((c) => c.status !== 'RESOLVED' && c.status !== 'CLOSED').length,
          avgResolutionDays: Math.round(avgResolutionDays),
          priorityDistribution,
        }
      })
      .sort((a, b) => b.totalCount - a.totalCount)
      .slice(0, limit)
  }

  generateReport(): ComplaintTrendReport {
    const periodTrends = this.analyzeTrend('MONTHLY')
    const topCategories = this.getTopCategories(5)
    const unresolvedCount = this.complaints.filter((c) => c.status === 'OPEN' || c.status === 'IN_PROGRESS').length

    const recommendations: string[] = []
    const lastTrend = periodTrends[periodTrends.length - 1]
    if (lastTrend && lastTrend.growthRatePct > 20) {
      recommendations.push(`최근 민원 ${lastTrend.growthRatePct}% 증가 — 처리 인력 증원 검토`)
    }
    const topCat = topCategories[0]
    if (topCat && topCat.unresolvedCount > 10) {
      recommendations.push(`'${topCat.category}' 카테고리 미해결 ${topCat.unresolvedCount}건 — 전담 처리팀 지정 필요`)
    }

    this.appendAudit('report.generate', 'system', { totalComplaints: this.complaints.length, unresolvedCount })
    return {
      totalComplaints: this.complaints.length,
      unresolvedCount,
      periodTrends,
      topCategories,
      recommendations,
      generatedAt: new Date().toISOString(),
    }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }

  private appendAudit(action: string, complaintId: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, complaintId, detail })
  }
}
