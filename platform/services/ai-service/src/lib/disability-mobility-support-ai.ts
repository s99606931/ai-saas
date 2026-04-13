// Plan SC: SVC-AI-ADV-R632
// Design Ref: §ROUTE_SCORE — 장애유형별 경로 접근성 점수 산정

type DataGrade = 'O' | 'C' | 'S'
type DisabilityType = 'wheelchair' | 'visual' | 'hearing' | 'cognitive'

interface RouteSegment {
  segmentId: string
  hasRamp: boolean
  hasElevator: boolean
  hasTactilePaving: boolean
  hasAudioGuide: boolean
  surfaceQuality: number
}

interface AccessRequest {
  requestId: string
  userId: string
  disabilityType: DisabilityType
  segments: string[]
}

interface AccessResult {
  requestId: string
  score: number
  accessible: boolean
  blockers: string[]
}

interface AuditEntry {
  action: string
  detail: string
  timestamp: string
}

const DATA_GRADE_BLOCK = ['C', 'S'] as const

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
}

export class DisabilityMobilitySupportAI {
  private segments = new Map<string, RouteSegment>()
  private auditLog: AuditEntry[] = []

  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerSegment(segment: RouteSegment): RouteSegment {
    this.segments.set(segment.segmentId, segment)
    this.log('segment.register', `segmentId=${segment.segmentId}`)
    return segment
  }

  evaluateRoute(req: AccessRequest, grade: DataGrade = 'O'): AccessResult {
    blockClassifiedData(grade)
    let totalScore = 0
    const blockers: string[] = []

    for (const segId of req.segments) {
      const seg = this.segments.get(segId)
      if (!seg) {
        blockers.push(`segment-missing:${segId}`)
        continue
      }
      totalScore += this.scoreSegment(seg, req.disabilityType, blockers, segId)
    }

    const avg = req.segments.length > 0 ? Math.round(totalScore / req.segments.length) : 0
    const accessible = avg >= 60 && blockers.length === 0

    this.log('route.evaluate', `requestId=${req.requestId} score=${avg} accessible=${accessible}`)
    return { requestId: req.requestId, score: avg, accessible, blockers }
  }

  private scoreSegment(
    seg: RouteSegment,
    type: DisabilityType,
    blockers: string[],
    segId: string,
  ): number {
    let score = seg.surfaceQuality * 20
    if (type === 'wheelchair') {
      if (!seg.hasRamp) blockers.push(`no-ramp:${segId}`)
      if (seg.hasRamp) score += 40
      if (seg.hasElevator) score += 40
    } else if (type === 'visual') {
      if (!seg.hasTactilePaving) blockers.push(`no-tactile:${segId}`)
      if (seg.hasTactilePaving) score += 50
      if (seg.hasAudioGuide) score += 30
    } else if (type === 'hearing') {
      score += 80
    } else {
      score += 60
    }
    return Math.min(100, score)
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
