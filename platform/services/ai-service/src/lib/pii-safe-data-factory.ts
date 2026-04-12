/**
 * PII-Safe Test Data Factory — SVC-AI-ADV-R102
 *
 * Design Ref: docs/02-design/mtus/SVC-AI-ADV-R102.design.md
 * Plan SC: FR-R102.1 ~ FR-R102.5
 *
 * 공공 DB 스키마 기반 PII 완전 제거 합성 데이터 생성기.
 * 개인정보보호법 준수 가명처리 방식.
 */

export type PiiType =
  | 'KR_RRN'
  | 'KR_PHONE'
  | 'EMAIL'
  | 'NAME'
  | 'ADDRESS'
  | 'NONE'

export interface FieldSpec {
  name: string
  piiType: PiiType
  distribution?: 'normal' | 'uniform' | 'categorical'
  params?: Record<string, unknown>
}

export interface FactoryOptions {
  seed?: number
}

const KR_RRN_REGEX = /\b\d{6}-[1-4]\d{6}\b/
const KR_PHONE_REGEX = /\b01\d-\d{3,4}-\d{4}\b/
const EMAIL_REGEX = /\b[\w.+-]+@[\w-]+\.[\w.-]+\b/

const NAME_POOL = ['홍길동', '이몽룡', '성춘향', '김철수', '박영희']

/** mulberry32 PRNG (seedable). */
function makePrng(seed: number): () => number {
  let state = seed >>> 0
  return () => {
    state |= 0
    state = (state + 0x6d2b79f5) | 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface PiiAuditEntry {
  timestamp: string
  action: 'generate' | 'verifyNoPii' | 'guardDataGrade'
  detail?: Record<string, unknown>
}

export type DataGrade = 'O' | 'C' | 'S'

export class PiiSafeDataFactory {
  private readonly rand: () => number
  private readonly auditLog: PiiAuditEntry[] = []

  constructor(opts: FactoryOptions = {}) {
    this.rand = makePrng(opts.seed ?? 42)
  }

  /**
   * N2SF N-05: C/S 등급 입력 차단 가드.
   */
  guardDataGrade(grade: DataGrade): void {
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'guardDataGrade',
      detail: { grade },
    })
    if (grade === 'C' || grade === 'S') {
      throw new Error(
        `BLOCKED: ${grade}등급 데이터는 합성 팩토리 입력 금지 (N2SF N-05)`,
      )
    }
  }

  /**
   * CSAP D-06: 감사 로그 조회 (append-only).
   */
  getAuditLog(): readonly PiiAuditEntry[] {
    return this.auditLog
  }

  /**
   * FR-R102.1~3: 스키마 기반 N건 생성.
   */
  generate(spec: FieldSpec[], count: number): Record<string, unknown>[] {
    const records: Record<string, unknown>[] = []
    for (let i = 0; i < count; i++) {
      const row: Record<string, unknown> = {}
      for (const field of spec) {
        row[field.name] = this.generateField(field, i)
      }
      records.push(row)
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'generate',
      detail: { count, fields: spec.length },
    })
    return records
  }

  /**
   * FR-R102.4: PII 재검증.
   */
  verifyNoPii(
    records: Record<string, unknown>[],
    spec: FieldSpec[],
  ): boolean {
    const piiFields = new Set(
      spec.filter((f) => f.piiType !== 'NONE').map((f) => f.name),
    )
    let ok = true
    outer: for (const rec of records) {
      for (const [key, val] of Object.entries(rec)) {
        if (!piiFields.has(key)) continue
        if (typeof val !== 'string') continue
        if (KR_RRN_REGEX.test(val) && val !== '000000-0000000') {
          ok = false
          break outer
        }
        if (KR_PHONE_REGEX.test(val) && !val.startsWith('010-0000-')) {
          ok = false
          break outer
        }
        if (EMAIL_REGEX.test(val) && !val.endsWith('@example.test')) {
          ok = false
          break outer
        }
      }
    }
    this.auditLog.push({
      timestamp: new Date().toISOString(),
      action: 'verifyNoPii',
      detail: { records: records.length, result: ok },
    })
    return ok
  }

  private generateField(field: FieldSpec, index: number): unknown {
    switch (field.piiType) {
      case 'KR_RRN':
        return '000000-0000000'
      case 'KR_PHONE': {
        const last = String(Math.floor(this.rand() * 10000)).padStart(4, '0')
        return `010-0000-${last}`
      }
      case 'EMAIL':
        return `user${index}@example.test`
      case 'NAME':
        return NAME_POOL[index % NAME_POOL.length]!
      case 'ADDRESS':
        return `서울특별시 종로구 세종로 ${(index % 10) + 1}`
      case 'NONE':
        return this.generateNonPii(field)
    }
  }

  private generateNonPii(field: FieldSpec): unknown {
    const dist = field.distribution ?? 'uniform'
    const params = field.params ?? {}
    switch (dist) {
      case 'uniform': {
        const min = Number(params.min ?? 0)
        const max = Number(params.max ?? 100)
        return Math.round(min + this.rand() * (max - min))
      }
      case 'normal': {
        const mean = Number(params.mean ?? 0)
        const stdDev = Number(params.stdDev ?? 1)
        // Box-Muller
        const u1 = Math.max(1e-9, this.rand())
        const u2 = this.rand()
        const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2)
        return mean + z * stdDev
      }
      case 'categorical': {
        const options = (params.options as string[] | undefined) ?? ['A']
        return options[Math.floor(this.rand() * options.length)]!
      }
    }
  }
}
