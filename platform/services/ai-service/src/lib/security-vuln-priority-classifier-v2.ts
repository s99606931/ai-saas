// Plan SC: SVC-AI-ADV-R470
// Design Ref: §점수공식 — cvssScore*10 + exploitBonus(public:30,private:15,none:0)
type Exploitability = 'public' | 'private' | 'none'
type VulnGrade = 'critical' | 'high' | 'medium' | 'low'
type DataGrade = 'O' | 'C' | 'S'

interface Vulnerability {
  vulnId: string; title: string; cvssScore: number
  exploitability: Exploitability; priorityScore: number; grade: VulnGrade
}
interface AuditEntry { action: string; detail: string; timestamp: string }

const EXPLOIT_BONUS: Record<Exploitability, number> = { public: 30, private: 15, none: 0 }

function calcGrade(score: number): VulnGrade {
  if (score >= 90) return 'critical'
  if (score >= 70) return 'high'
  if (score >= 50) return 'medium'
  return 'low'
}

export class SecurityVulnPriorityClassifierV2 {
  private vulns = new Map<string, Vulnerability>()
  private auditLog: AuditEntry[] = []

  private checkGrade(grade?: DataGrade): void {
    if (grade === 'C' || grade === 'S') throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`)
  }
  private log(action: string, detail: string): void {
    this.auditLog.push({ action, detail, timestamp: new Date().toISOString() })
  }

  registerVuln(vulnId: string, title: string, cvssScore: number, exploitability: Exploitability, dataGrade?: DataGrade): Vulnerability {
    this.checkGrade(dataGrade)
    const priorityScore = cvssScore * 10 + EXPLOIT_BONUS[exploitability]
    const vuln: Vulnerability = { vulnId, title, cvssScore, exploitability, priorityScore, grade: calcGrade(priorityScore) }
    this.vulns.set(vulnId, vuln)
    this.log('vuln.register', `vulnId=${vulnId} priorityScore=${priorityScore}`)
    return vuln
  }

  getPriorityScore(vulnId: string): number {
    if (!this.vulns.has(vulnId)) throw new Error('vulnId 없음')
    return this.vulns.get(vulnId)!.priorityScore
  }

  getVulnGrade(vulnId: string): VulnGrade {
    if (!this.vulns.has(vulnId)) throw new Error('vulnId 없음')
    return this.vulns.get(vulnId)!.grade
  }

  getVulnsByGrade(grade: VulnGrade): Vulnerability[] {
    return Array.from(this.vulns.values()).filter((v) => v.grade === grade)
  }

  getAuditLog(): AuditEntry[] { return [...this.auditLog] }
}
