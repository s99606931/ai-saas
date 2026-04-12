/**
 * Unit tests for Deployment Checklist AI — SVC-AI-ADV-R124
 */
import { describe, it, expect } from 'vitest'
import { DeploymentChecklistAi, DataGrade } from '../deployment-checklist-ai'

describe('SVC-AI-ADV-R124 DeploymentChecklistAi', () => {
  it('[FR-R124.1] generates checklist for schema-migration', () => {
    const engine = new DeploymentChecklistAi()
    const checklist = engine.generateChecklist('PR-1', [
      { file: 'migration.sql', changeType: 'schema-migration', linesAdded: 10, linesRemoved: 0, grade: DataGrade.O },
    ])
    expect(checklist.prId).toBe('PR-1')
    expect(checklist.items.some(i => i.id === 'DB-01')).toBe(true)
  })

  it('[FR-R124.4] risk level is CRITICAL for schema-migration', () => {
    const engine = new DeploymentChecklistAi()
    const checklist = engine.generateChecklist('PR-2', [
      { file: 'migration.sql', changeType: 'schema-migration', linesAdded: 5, linesRemoved: 0, grade: DataGrade.O },
    ])
    expect(checklist.riskLevel).toBe('CRITICAL')
  })

  it('[FR-R124.4] risk level LOW for simple bugfix', () => {
    const engine = new DeploymentChecklistAi()
    const checklist = engine.generateChecklist('PR-3', [
      { file: 'utils.ts', changeType: 'bugfix', linesAdded: 3, linesRemoved: 2, grade: DataGrade.O },
    ])
    expect(checklist.riskLevel).toBe('LOW')
  })

  it('[FR-R124.5] completeItem marks item as completed', () => {
    const engine = new DeploymentChecklistAi()
    const checklist = engine.generateChecklist('PR-4', [
      { file: 'app.ts', changeType: 'feature', linesAdded: 100, linesRemoved: 0, grade: DataGrade.O },
    ])
    const firstRequired = checklist.items.find(i => i.required)!
    engine.completeItem(checklist, firstRequired.id)
    expect(checklist.items.find(i => i.id === firstRequired.id)!.completed).toBe(true)
  })

  it('[FR-R124.6] isReadyToDeploy false until all required complete', () => {
    const engine = new DeploymentChecklistAi()
    const checklist = engine.generateChecklist('PR-5', [
      { file: 'api.ts', changeType: 'api-breaking', linesAdded: 20, linesRemoved: 5, grade: DataGrade.O },
    ])
    expect(engine.isReadyToDeploy(checklist)).toBe(false)
    const requiredItems = checklist.items.filter(i => i.required)
    for (const item of requiredItems) {
      engine.completeItem(checklist, item.id)
    }
    expect(engine.isReadyToDeploy(checklist)).toBe(true)
  })

  it('[FR-R124] blocks C/S grade changes', () => {
    const engine = new DeploymentChecklistAi()
    expect(() => engine.generateChecklist('PR-6', [
      { file: 'secret.ts', changeType: 'feature', linesAdded: 1, linesRemoved: 0, grade: DataGrade.C },
    ])).toThrow('BLOCKED')
  })

  it('deduplicates items from multiple changes of same type', () => {
    const engine = new DeploymentChecklistAi()
    const checklist = engine.generateChecklist('PR-7', [
      { file: 'a.ts', changeType: 'bugfix', linesAdded: 1, linesRemoved: 0, grade: DataGrade.O },
      { file: 'b.ts', changeType: 'bugfix', linesAdded: 1, linesRemoved: 0, grade: DataGrade.O },
    ])
    const bugfixItems = checklist.items.filter(i => i.id.startsWith('BUG-'))
    const ids = bugfixItems.map(i => i.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('audit log records generateChecklist', () => {
    const engine = new DeploymentChecklistAi()
    engine.generateChecklist('PR-8', [
      { file: 'x.ts', changeType: 'feature', linesAdded: 10, linesRemoved: 0, grade: DataGrade.O },
    ])
    expect(engine.getAuditLog().some(e => e.action === 'generateChecklist')).toBe(true)
  })
})
