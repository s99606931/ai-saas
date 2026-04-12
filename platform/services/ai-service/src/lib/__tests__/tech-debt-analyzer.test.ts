/**
 * Unit tests for Tech Debt Analyzer — SVC-AI-ADV-R122
 */
import { describe, it, expect } from 'vitest'
import { TechDebtAnalyzer, DataGrade } from '../tech-debt-analyzer'

const makeFile = (overrides = {}) => ({
  path: 'src/foo.ts',
  lines: 100,
  cyclomaticComplexity: 5,
  duplicateRatio: 0.1,
  dependencyAge: 90,
  grade: DataGrade.O,
  ...overrides,
})

describe('SVC-AI-ADV-R122 TechDebtAnalyzer', () => {
  it('[FR-R122.1] registers file and stores metrics', () => {
    const analyzer = new TechDebtAnalyzer()
    analyzer.registerFile(makeFile())
    const result = analyzer.analyze()
    expect(result.files).toHaveLength(1)
  })

  it('[FR-R122.5] blocks C/S grade files', () => {
    const analyzer = new TechDebtAnalyzer()
    expect(() => analyzer.registerFile(makeFile({ grade: DataGrade.C }))).toThrow('BLOCKED')
    expect(() => analyzer.registerFile(makeFile({ grade: DataGrade.S }))).toThrow('BLOCKED')
  })

  it('[FR-R122.2] high cyclomatic complexity raises debt', () => {
    const analyzer = new TechDebtAnalyzer()
    analyzer.registerFile(makeFile({ cyclomaticComplexity: 60 }))
    const result = analyzer.analyze()
    expect(result.files[0]!.complexityDebt).toBe(100)
  })

  it('[FR-R122.3] high duplication ratio raises debt', () => {
    const analyzer = new TechDebtAnalyzer()
    analyzer.registerFile(makeFile({ duplicateRatio: 0.8 }))
    const result = analyzer.analyze()
    expect(result.files[0]!.duplicationDebt).toBeGreaterThanOrEqual(80)
  })

  it('[FR-R122.4] old dependency raises debt', () => {
    const analyzer = new TechDebtAnalyzer()
    analyzer.registerFile(makeFile({ dependencyAge: 800 }))
    const result = analyzer.analyze()
    expect(result.files[0]!.dependencyDebt).toBeGreaterThanOrEqual(50)
  })

  it('[FR-R122.6] analyze returns hotspots for HIGH/CRITICAL severity', () => {
    const analyzer = new TechDebtAnalyzer()
    analyzer.registerFile(makeFile({ cyclomaticComplexity: 60, duplicateRatio: 0.9, dependencyAge: 1000 }))
    analyzer.registerFile(makeFile({ path: 'clean.ts', cyclomaticComplexity: 3, duplicateRatio: 0.0, dependencyAge: 10 }))
    const result = analyzer.analyze()
    expect(result.hotspots.length).toBeGreaterThanOrEqual(1)
    expect(['HIGH', 'CRITICAL']).toContain(result.hotspots[0]!.severity)
  })

  it('[FR-R122.8] audit log records actions', () => {
    const analyzer = new TechDebtAnalyzer()
    analyzer.registerFile(makeFile())
    analyzer.analyze()
    const log = analyzer.getAuditLog()
    expect(log.some(e => e.action === 'registerFile')).toBe(true)
    expect(log.some(e => e.action === 'analyze')).toBe(true)
  })

  it('overwrites existing file on re-register', () => {
    const analyzer = new TechDebtAnalyzer()
    analyzer.registerFile(makeFile({ cyclomaticComplexity: 5 }))
    analyzer.registerFile(makeFile({ cyclomaticComplexity: 50 }))
    const result = analyzer.analyze()
    expect(result.files).toHaveLength(1)
    expect(result.files[0]!.complexityDebt).toBeGreaterThan(50)
  })
})
