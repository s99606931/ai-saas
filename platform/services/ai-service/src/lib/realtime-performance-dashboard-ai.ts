// Design Ref: §클래스 설계 — RealtimePerformanceDashboardAi
// Plan SC: SVC-AI-ADV-R550

interface DashboardPanel {
  panelId: string
  name: string
  metricType: string
  alertThreshold: number
}

interface AuditEntry { timestamp: string; action: string; panelId: string; details?: Record<string, unknown> }

export class RealtimePerformanceDashboardAi {
  private panels = new Map<string, DashboardPanel>()
  private currentValues = new Map<string, number>()
  private auditLog: AuditEntry[] = []

  registerPanel(panelId: string, name: string, metricType: string, alertThreshold: number): DashboardPanel {
    const panel: DashboardPanel = { panelId, name, metricType, alertThreshold }
    this.panels.set(panelId, panel)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'REGISTER_PANEL', panelId, details: { name, metricType, alertThreshold } })
    return panel
  }

  updateMetric(panelId: string, value: number, dataGrade?: string): void {
    if (dataGrade === 'C' || dataGrade === 'S') throw new Error(`BLOCKED: ${dataGrade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
    if (!this.panels.has(panelId)) throw new Error(`패널을 찾을 수 없습니다: ${panelId}`)
    this.currentValues.set(panelId, value)
    this.auditLog.push({ timestamp: new Date().toISOString(), action: 'UPDATE_METRIC', panelId, details: { value } })
  }

  getCurrentValue(panelId: string): number {
    return this.currentValues.get(panelId) ?? 0
  }

  getAlertingPanels(): DashboardPanel[] {
    return Array.from(this.panels.values()).filter(p => this.getCurrentValue(p.panelId) > p.alertThreshold)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
