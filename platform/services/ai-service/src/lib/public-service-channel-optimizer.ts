// Design Ref: §핵심 알고리즘 — 채널 점수, 최적 채널 추천
// Plan SC: SVC-AI-ADV-R344
export type DataGrade = 'O' | 'C' | 'S'

export interface Channel {
  id: string
  name: string
  channelType: string
  usageEvents: Array<{ usageCount: number; satisfactionScore: number }>
}

export interface ChannelStats {
  channelId: string
  name: string
  channelType: string
  totalUsage: number
  avgSatisfaction: number
  channelScore: number
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class PublicServiceChannelOptimizer {
  private channels = new Map<string, Channel>()
  private auditLog: AuditEntry[] = []

  registerChannel(id: string, name: string, channelType: string): void {
    if (!id || !name || !channelType) throw new Error('id, name, channelType은 필수')
    this.channels.set(id, { id, name, channelType, usageEvents: [] })
    this.auditLog.push({ action: 'channel.register', timestamp: new Date().toISOString(), detail: id })
  }

  recordUsage(channelId: string, usageCount: number, satisfactionScore: number, grade: DataGrade = 'O'): void {
    if (grade === 'C' || grade === 'S') {
      throw new Error(`BLOCKED: ${grade}등급 채널 데이터 전송 금지 (N2SF N-05)`)
    }
    const ch = this.channels.get(channelId)
    if (!ch) throw new Error(`channelId 없음: ${channelId}`)
    ch.usageEvents.push({ usageCount, satisfactionScore })
    this.auditLog.push({ action: 'usage.record', timestamp: new Date().toISOString(), detail: `${channelId}:${usageCount}` })
  }

  getChannelStats(channelId: string): ChannelStats {
    const ch = this.channels.get(channelId)
    if (!ch) throw new Error(`channelId 없음: ${channelId}`)
    const totalUsage = ch.usageEvents.reduce((s, e) => s + e.usageCount, 0)
    const avgSatisfaction = ch.usageEvents.length === 0
      ? 0
      : Math.round(ch.usageEvents.reduce((s, e) => s + e.satisfactionScore, 0) / ch.usageEvents.length * 100) / 100
    // usageRate = totalUsage / max(1, totalUsage) * 100 = relative; simplify: use totalUsage as usageRate proxy
    const channelScore = Math.round(totalUsage * avgSatisfaction) / 100
    return { channelId, name: ch.name, channelType: ch.channelType, totalUsage, avgSatisfaction, channelScore }
  }

  getOptimalChannel(): ChannelStats {
    const stats = [...this.channels.keys()].map((id) => this.getChannelStats(id))
    if (stats.length === 0) throw new Error('등록된 채널이 없습니다')
    return stats.sort((a, b) => b.channelScore - a.channelScore)[0]!
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
