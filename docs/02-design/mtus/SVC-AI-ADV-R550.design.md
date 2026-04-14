# SVC-AI-ADV-R550 Design — realtime-performance-dashboard-ai.ts
Plan Ref: SVC-AI-ADV-R550.plan.md
## 클래스 설계
```typescript
class RealtimePerformanceDashboardAi {
  registerPanel(panelId, name, metricType, alertThreshold): DashboardPanel
  updateMetric(panelId, value, dataGrade?): void
  getCurrentValue(panelId): number
  getAlertingPanels(): DashboardPanel[]  // currentValue > alertThreshold
  getAuditLog(): AuditEntry[]
}
```
