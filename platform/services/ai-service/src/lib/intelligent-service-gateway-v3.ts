// Plan SC: SVC-AI-ADV-R472
// Design Ref: §RateLimit — clientId+routeId 조합으로 요청 수 추적, 초과 시 rejected
type DataGrade = 'O' | 'C' | 'S'

interface Route { routeId: string; path: string; targetService: string; rateLimit: number }
interface RequestResult { allowed: boolean; targetService?: string; reason?: string }
interface RouteStats { totalRequests: number; rejectedRequests: number }
interface AuditEntry { action: string; detail: string; timestamp: string }

export class IntelligentServiceGatewayV3 {
  private routes = new Map<string, Route>()
  private routesByPath = new Map<string, Route>()
  private clientRequests = new Map<string, number>()
  private stats = new Map<string, RouteStats>()
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerRoute(routeId: string, path: string, targetService: string, rateLimit: number): Route {
    const route: Route = { routeId, path, targetService, rateLimit }
    this.routes.set(routeId, route)
    this.routesByPath.set(path, route)
    this.stats.set(routeId, { totalRequests: 0, rejectedRequests: 0 })
    this.log('route.register', `routeId=${routeId} path=${path}`)
    return route
  }

  processRequest(path: string, clientId: string, dataGrade?: DataGrade): RequestResult {
    this.checkGrade(dataGrade)
    const route = this.routesByPath.get(path)
    if (!route) return { allowed: false, reason: '경로 없음' }
    const key = `${route.routeId}:${clientId}`
    const count = (this.clientRequests.get(key) ?? 0) + 1
    this.clientRequests.set(key, count)
    const stats = this.stats.get(route.routeId)!
    stats.totalRequests++
    if (count > route.rateLimit) {
      stats.rejectedRequests++
      this.log('request.reject', `path=${path} clientId=${clientId}`)
      return { allowed: false, reason: 'rate limit 초과' }
    }
    this.log('request.allow', `path=${path} clientId=${clientId}`)
    return { allowed: true, targetService: route.targetService }
  }

  getRouteStats(routeId: string): RouteStats {
    return this.stats.get(routeId) ?? { totalRequests: 0, rejectedRequests: 0 }
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
