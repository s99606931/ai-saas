// Design Ref: §R321 — AI기반 장애 패턴 라이브러리
// Plan SC: SC-R321

export interface FailurePattern {
  patternId: string
  name: string
  symptoms: string[]
  rootCauses: string[]
  resolutionSteps: string[]
  preventionMeasures: string[]
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  category: 'NETWORK' | 'DATABASE' | 'MEMORY' | 'CPU' | 'DISK' | 'APPLICATION' | 'SECURITY'
}

export interface IncidentReport {
  incidentId: string
  observedSymptoms: string[]
  serviceId: string
  timestamp: number
}

export interface PatternMatch {
  patternId: string
  patternName: string
  matchScore: number
  confidence: number
  suggestedResolutions: string[]
  preventionMeasures: string[]
}

export interface DiagnosisResult {
  incidentId: string
  topMatches: PatternMatch[]
  isRecognized: boolean
  recommendedEscalation: boolean
}

interface AuditEntry {
  action: string
  timestamp: string
  detail: string
}

export class FailurePatternLibraryAi {
  private patterns = new Map<string, FailurePattern>()
  private auditLog: AuditEntry[] = []

  registerPattern(pattern: FailurePattern): void {
    this.patterns.set(pattern.patternId, pattern)
    this.auditLog.push({ action: 'pattern.register', timestamp: new Date().toISOString(), detail: pattern.patternId })
  }

  diagnose(incident: IncidentReport): DiagnosisResult {
    const matches: PatternMatch[] = []

    for (const pattern of this.patterns.values()) {
      const matchedSymptoms = incident.observedSymptoms.filter((s) =>
        pattern.symptoms.some((ps) => ps.toLowerCase().includes(s.toLowerCase()) || s.toLowerCase().includes(ps.toLowerCase()))
      )

      if (matchedSymptoms.length === 0) continue

      const matchScore = Math.round((matchedSymptoms.length / pattern.symptoms.length) * 100)
      const confidence = Math.round((matchedSymptoms.length / Math.max(incident.observedSymptoms.length, 1)) * 100)

      matches.push({
        patternId: pattern.patternId,
        patternName: pattern.name,
        matchScore,
        confidence,
        suggestedResolutions: pattern.resolutionSteps,
        preventionMeasures: pattern.preventionMeasures,
      })
    }

    matches.sort((a, b) => b.matchScore - a.matchScore)
    const topMatches = matches.slice(0, 3)

    const isRecognized = topMatches.length > 0 && topMatches[0] !== undefined && topMatches[0].matchScore >= 50
    const recommendedEscalation = !isRecognized || (topMatches[0] !== undefined && topMatches[0].confidence < 40)

    this.auditLog.push({ action: 'incident.diagnose', timestamp: new Date().toISOString(), detail: incident.incidentId })
    return { incidentId: incident.incidentId, topMatches, isRecognized, recommendedEscalation }
  }

  getAuditLog(): AuditEntry[] {
    return [...this.auditLog]
  }
}
