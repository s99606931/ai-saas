/**
 * Compliance Report Generator — SVC-AI-ADV-R122
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R122.design.md
 * Plan SC: FR-R122.1 ~ FR-R122.8
 *
 * CSAP/N2SF/행안부 감리 준수 보고서 자동 생성.
 * CSAP D-06 감사, N2SF C/S 등급 guard.
 */

export enum DataGrade {
  C = 'C',
  S = 'S',
  O = 'O',
}

export type Framework = 'CSAP' | 'N2SF' | 'MOIS'

export type ControlStatus =
  | 'compliant'
  | 'partial'
  | 'non-compliant'
  | 'not-applicable'

export interface ControlItem {
  id: string
  framework: Framework
  description: string
  required: boolean
}

export interface Evidence {
  controlId: string
  path: string
  description: string
  addedAt: string
  grade: DataGrade
}

export interface ControlRecord {
  control: ControlItem
  status: ControlStatus
  evidences: Evidence[]
  note?: string
}

export interface FrameworkCoverage {
  framework: Framework
  totalRequired: number
  compliant: number
  partial: number
  nonCompliant: number
  notApplicable: number
  coverageRate: number
}

export interface ComplianceSummary {
  generatedAt: string
  frameworks: FrameworkCoverage[]
  missing: string[]
  totalControls: number
}

export interface CRGAuditEntry {
  timestamp: string
  action:
    | 'registerControl'
    | 'setStatus'
    | 'addEvidence'
    | 'gradeBlocked'
    | 'generateSummary'
    | 'renderMarkdown'
  detail?: Record<string, unknown>
}

export class ComplianceReportGenerator {
  private readonly records: Map<string, ControlRecord> = new Map()
  private readonly auditLog: CRGAuditEntry[] = []

  getAuditLog(): readonly CRGAuditEntry[] {
    return this.auditLog
  }

  private audit(
    action: CRGAuditEntry['action'],
    detail?: Record<string, unknown>,
  ): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action,
      ...(detail !== undefined ? { detail } : {}),
    })
  }

  /**
   * FR-R122.1: 통제항목 등록.
   */
  registerControl(control: ControlItem): void {
    this.records.set(control.id, {
      control,
      status: 'non-compliant',
      evidences: [],
    })
    this.audit('registerControl', {
      id: control.id,
      framework: control.framework,
    })
  }

  listControls(): ControlRecord[] {
    return Array.from(this.records.values())
  }

  /**
   * FR-R122.3: 이행 상태 갱신.
   */
  setStatus(
    controlId: string,
    status: ControlStatus,
    note?: string,
  ): void {
    const record = this.records.get(controlId)
    if (!record) {
      throw new Error(`Unknown control: ${controlId}`)
    }
    record.status = status
    if (note !== undefined) {
      record.note = note
    }
    this.audit('setStatus', { controlId, status })
  }

  /**
   * FR-R122.2 / FR-R122.7: 증적 등록 + 등급 guard.
   */
  addEvidence(evidence: Evidence): void {
    if (evidence.grade === DataGrade.C || evidence.grade === DataGrade.S) {
      this.audit('gradeBlocked', {
        grade: evidence.grade,
        controlId: evidence.controlId,
      })
      throw new Error(
        `BLOCKED: ${evidence.grade}등급 증적은 리포트 전송 금지 (N2SF N-05)`,
      )
    }

    const record = this.records.get(evidence.controlId)
    if (!record) {
      throw new Error(`Unknown control: ${evidence.controlId}`)
    }
    record.evidences.push(evidence)
    this.audit('addEvidence', {
      controlId: evidence.controlId,
      path: evidence.path,
    })
  }

  /**
   * FR-R122.4 / FR-R122.6: 커버리지 요약 계산.
   */
  getSummary(): ComplianceSummary {
    const groups = new Map<Framework, ControlRecord[]>()
    for (const record of this.records.values()) {
      const list = groups.get(record.control.framework) ?? []
      list.push(record)
      groups.set(record.control.framework, list)
    }

    const frameworks: FrameworkCoverage[] = []
    const missing: string[] = []

    for (const [framework, list] of groups.entries()) {
      const requiredList = list.filter((r) => r.control.required)
      const totalRequired = requiredList.length
      const compliant = requiredList.filter(
        (r) => r.status === 'compliant',
      ).length
      const partial = requiredList.filter((r) => r.status === 'partial').length
      const nonCompliant = requiredList.filter(
        (r) => r.status === 'non-compliant',
      ).length
      const notApplicable = list.filter(
        (r) => r.status === 'not-applicable',
      ).length

      frameworks.push({
        framework,
        totalRequired,
        compliant,
        partial,
        nonCompliant,
        notApplicable,
        coverageRate: totalRequired === 0 ? 1 : compliant / totalRequired,
      })

      for (const record of requiredList) {
        if (
          record.status === 'non-compliant' ||
          record.status === 'partial'
        ) {
          missing.push(record.control.id)
        }
      }
    }

    const summary: ComplianceSummary = {
      generatedAt: new Date().toISOString(),
      frameworks: frameworks.sort((a, b) =>
        a.framework.localeCompare(b.framework),
      ),
      missing: missing.sort(),
      totalControls: this.records.size,
    }

    this.audit('generateSummary', {
      frameworks: frameworks.length,
      missing: missing.length,
    })
    return summary
  }

  /**
   * FR-R122.5: Markdown 리포트 렌더링.
   */
  renderMarkdown(options: { title?: string } = {}): string {
    const title = options.title ?? '규정 준수 현황 보고서'
    const summary = this.getSummary()
    const lines: string[] = []

    lines.push(`# ${title}`)
    lines.push('')
    lines.push(`생성일: ${summary.generatedAt}`)
    lines.push('')
    lines.push('## 프레임워크별 커버리지')
    lines.push('')
    lines.push('| 프레임워크 | 총 필수항목 | 이행 | 부분 | 미이행 | 해당없음 | 커버리지 |')
    lines.push('|---|---|---|---|---|---|---|')
    for (const f of summary.frameworks) {
      const pct = (f.coverageRate * 100).toFixed(1)
      lines.push(
        `| ${f.framework} | ${f.totalRequired} | ${f.compliant} | ${f.partial} | ${f.nonCompliant} | ${f.notApplicable} | ${pct}% |`,
      )
    }
    lines.push('')

    lines.push('## 미흡 항목')
    lines.push('')
    if (summary.missing.length === 0) {
      lines.push('- 미흡 항목 없음')
    } else {
      for (const id of summary.missing) {
        const record = this.records.get(id)
        if (!record) continue
        lines.push(
          `- **[${id}]** ${record.control.description} — 상태: ${record.status} — 증적: ${record.evidences.length}건${
            record.note ? ` — 비고: ${record.note}` : ''
          }`,
        )
      }
    }
    lines.push('')

    lines.push('## 증적 전수')
    lines.push('')
    for (const record of this.records.values()) {
      if (record.evidences.length === 0) continue
      for (const e of record.evidences) {
        lines.push(
          `- **[${record.control.id}]** ${e.path} (${e.addedAt}) — ${e.description}`,
        )
      }
    }
    lines.push('')

    this.audit('renderMarkdown', { length: lines.length })
    return lines.join('\n')
  }
}
