// Plan SC: SVC-AI-ADV-R488-SC01
import { describe, it, expect, beforeEach } from 'vitest'
import { OrgStructureOptimizerAI, type Department } from '../org-structure-optimizer-ai'

describe('OrgStructureOptimizerAI', () => {
  let optimizer: OrgStructureOptimizerAI

  const largeDept: Department = {
    deptId: 'DEPT-A',
    name: '행정지원팀',
    type: 'SUPPORT',
    headCount: 15,
    annualBudgetKrw: 500_000_000,
    taskCount: 30,
    avgTaskDuration: 3,
    overlapDepts: [],
  }

  beforeEach(() => {
    optimizer = new OrgStructureOptimizerAI()
  })

  it('부서 없을 때 → suggestions=0', () => {
    const report = optimizer.optimize()
    expect(report.suggestions).toHaveLength(0)
    expect(report.totalDepts).toBe(0)
  })

  it('소규모 중복 부서 → MERGE 제안', () => {
    optimizer.registerDept({
      ...largeDept,
      deptId: 'DEPT-SMALL',
      name: '소규모팀',
      headCount: 2,
      overlapDepts: ['DEPT-B'],
    })
    optimizer.registerDept({ ...largeDept, deptId: 'DEPT-B', name: 'B팀', headCount: 5, overlapDepts: [] })
    const report = optimizer.optimize()
    expect(report.suggestions.some((s) => s.action === 'MERGE' && s.deptId === 'DEPT-SMALL')).toBe(true)
  })

  it('과부하 부서 (1인당 5+ 업무, 10일+) → SPLIT 제안', () => {
    optimizer.registerDept({
      ...largeDept,
      deptId: 'DEPT-OVER',
      name: '과부하팀',
      headCount: 2,
      taskCount: 12,
      avgTaskDuration: 15,
      overlapDepts: [],
    })
    const report = optimizer.optimize()
    expect(report.suggestions.some((s) => s.action === 'SPLIT' && s.deptId === 'DEPT-OVER')).toBe(true)
  })

  it('SUPPORT 부서 10명 이상 → OUTSOURCE 제안', () => {
    optimizer.registerDept(largeDept)
    const report = optimizer.optimize()
    expect(report.suggestions.some((s) => s.action === 'OUTSOURCE' && s.deptId === 'DEPT-A')).toBe(true)
  })

  it('estimatedTotalSavingKrw 합산 정확', () => {
    optimizer.registerDept(largeDept)
    const report = optimizer.optimize()
    const sum = report.suggestions.reduce((s, sg) => s + sg.estimatedSavingKrw, 0)
    expect(report.estimatedTotalSavingKrw).toBe(sum)
  })

  it('중복 클러스터 구성 정확', () => {
    optimizer.registerDept({ ...largeDept, deptId: 'DA', headCount: 2, overlapDepts: ['DB'] })
    optimizer.registerDept({ ...largeDept, deptId: 'DB', headCount: 3, overlapDepts: [] })
    const report = optimizer.optimize()
    expect(report.overlapClusters.length).toBeGreaterThan(0)
    expect(report.overlapClusters[0]).toContain('DA')
  })

  it('getAuditLog: 복사본 반환 (불변성 보장)', () => {
    optimizer.registerDept(largeDept)
    optimizer.optimize()
    const log1 = optimizer.getAuditLog()
    log1.push({ timestamp: '2026-01-01', action: 'tamper', deptId: 'X', detail: {} })
    const log2 = optimizer.getAuditLog()
    expect(log2.length).toBe(log1.length - 1)
  })
})
