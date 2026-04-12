/**
 * Unit tests for PII-Safe Test Data Factory — SVC-AI-ADV-R102
 */

import { describe, it, expect } from 'vitest'
import {
  PiiSafeDataFactory,
  type FieldSpec,
} from '../pii-safe-data-factory'

const spec: FieldSpec[] = [
  { name: 'name', piiType: 'NAME' },
  { name: 'rrn', piiType: 'KR_RRN' },
  { name: 'phone', piiType: 'KR_PHONE' },
  { name: 'email', piiType: 'EMAIL' },
  { name: 'addr', piiType: 'ADDRESS' },
  {
    name: 'age',
    piiType: 'NONE',
    distribution: 'uniform',
    params: { min: 20, max: 70 },
  },
  {
    name: 'region',
    piiType: 'NONE',
    distribution: 'categorical',
    params: { options: ['SEOUL', 'BUSAN'] },
  },
]

describe('SVC-AI-ADV-R102 PiiSafeDataFactory', () => {
  it('[FR-R102.1] generates N records', () => {
    const f = new PiiSafeDataFactory({ seed: 1 })
    const records = f.generate(spec, 5)
    expect(records).toHaveLength(5)
    expect(records[0]!.name).toBeDefined()
  })

  it('[FR-R102.2] PII fields use safe replacements', () => {
    const f = new PiiSafeDataFactory({ seed: 1 })
    const records = f.generate(spec, 3)
    for (const r of records) {
      expect(r.rrn).toBe('000000-0000000')
      expect(r.phone).toMatch(/^010-0000-\d{4}$/)
      expect(r.email).toMatch(/@example\.test$/)
    }
  })

  it('[FR-R102.4] verifyNoPii returns true for generated data', () => {
    const f = new PiiSafeDataFactory({ seed: 1 })
    const records = f.generate(spec, 5)
    expect(f.verifyNoPii(records, spec)).toBe(true)
  })

  it('[FR-R102.4] verifyNoPii detects real-looking RRN', () => {
    const f = new PiiSafeDataFactory({ seed: 1 })
    const fake = [{ rrn: '900101-1234567' }] // real-looking
    expect(f.verifyNoPii(fake, [{ name: 'rrn', piiType: 'KR_RRN' }])).toBe(false)
  })

  it('[FR-R102.5] seed reproducibility', () => {
    const f1 = new PiiSafeDataFactory({ seed: 42 })
    const f2 = new PiiSafeDataFactory({ seed: 42 })
    const r1 = f1.generate(spec, 3)
    const r2 = f2.generate(spec, 3)
    expect(r1).toEqual(r2)
  })

  it('[FR-R102.3] uniform distribution within bounds', () => {
    const f = new PiiSafeDataFactory({ seed: 7 })
    const records = f.generate(spec, 20)
    for (const r of records) {
      expect(r.age).toBeGreaterThanOrEqual(20)
      expect(r.age).toBeLessThanOrEqual(70)
    }
  })

  it('[FR-R102.3] categorical only from options', () => {
    const f = new PiiSafeDataFactory({ seed: 3 })
    const records = f.generate(spec, 10)
    for (const r of records) {
      expect(['SEOUL', 'BUSAN']).toContain(r.region)
    }
  })

  it('[CSAP D-06] getAuditLog captures generate/verify actions', () => {
    const f = new PiiSafeDataFactory({ seed: 1 })
    f.generate(spec, 2)
    f.verifyNoPii([], spec)
    const log = f.getAuditLog()
    expect(log.some((e) => e.action === 'generate')).toBe(true)
    expect(log.some((e) => e.action === 'verifyNoPii')).toBe(true)
  })

  it('[N2SF N-05] guardDataGrade blocks C/S', () => {
    const f = new PiiSafeDataFactory({ seed: 1 })
    expect(() => f.guardDataGrade('C')).toThrow(/BLOCKED/)
    expect(() => f.guardDataGrade('S')).toThrow(/BLOCKED/)
    expect(() => f.guardDataGrade('O')).not.toThrow()
  })
})
