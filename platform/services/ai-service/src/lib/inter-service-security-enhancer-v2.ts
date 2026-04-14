// Design Ref: §클래스 설계 — InterServiceSecurityEnhancerV2
// Plan SC: SVC-AI-ADV-R552

interface ServiceChannel {
  channelId: string
  fromService: string
  toService: string
  protocol: string
}

interface CheckRecord {
  checkType: string
  passed: boolean
}

interface AuditEntry { timestamp: string; action: string; channelId: string; details?: Record<string, unknown> }

export class InterServiceSecurityEnhancerV2 {
  private channels = new Map<string, ServiceChannel>()
  private checks = new Map<string, CheckRecord[]>()
  private auditLog: AuditEntry[] = []

  registerChannel(channelId: string, fromService: string, toService: string, protocol: string): ServiceChannel {
    const channel: ServiceChannel = { channelId, fromService, toService, protocol }
    this.channels.set(channelId, channel)
    this.checks.set(channelId, [])
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_CHANNEL', channelId, details: { fromService, toService, protocol } })
    return channel
  }

  recordCheck(channelId: string, checkType: string, passed: boolean, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.channels.has(channelId)) throw new Error(`채널을 찾을 수 없습니다: ${channelId}`)
    this.checks.get(channelId)!.push({ checkType, passed })
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'RECORD_CHECK', channelId, details: { checkType, passed } })
  }

  getSecurityScore(channelId: string): number {
    const records = this.checks.get(channelId) ?? []
    if (records.length === 0) return 100
    return (records.filter(r => r.passed).length / records.length) * 100
  }

  getLowSecurityChannels(): ServiceChannel[] {
    return Array.from(this.channels.values()).filter(c => this.getSecurityScore(c.channelId) < 70)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
