/**
 * Unit tests for Security Patch Prioritizer — SVC-AI-ADV-R105
 */

import { describe, it, expect } from 'vitest'
import {
  SecurityPatchPrioritizer,
  type Vulnerability,
  type Asset,
} from '../security-patch-prioritizer'

describe('SVC-AI-ADV-R105 SecurityPatchPrioritizer', () => {
  it('[FR-R105.1] prioritizes vulnerabilities', () => {
    const p = new SecurityPatchPrioritizer()
    const vulns: Vulnerability[] = [
      {
        id: 'CVE-2026-1',
        cvssScore: 9.8,
        epssScore: 0.9,
        affectedAssetIds: ['web1'],
      },
      {
        id: 'CVE-2026-2',
        cvssScore: 5.0,
        epssScore: 0.1,
        affectedAssetIds: ['internal1'],
      },
    ]
    const assets: Asset[] = [
      { id: 'web1', criticality: 9, internetFacing: true },
      { id: 'internal1', criticality: 3, internetFacing: false },
    ]
    const result = p.prioritize(vulns, assets)
    expect(result[0]!.vuln.id).toBe('CVE-2026-1')
    expect(result[0]!.priority).toBe('P0')
  })

  it('[FR-R105.2] internet-facing raises score', () => {
    const p = new SecurityPatchPrioritizer()
    const vuln: Vulnerability = {
      id: 'CVE-x',
      cvssScore: 5,
      epssScore: 0.1,
      affectedAssetIds: ['a'],
    }
    const facing = p.prioritize(
      [vuln],
      [{ id: 'a', criticality: 5, internetFacing: true }],
    )
    const internal = p.prioritize(
      [vuln],
      [{ id: 'a', criticality: 5, internetFacing: false }],
    )
    expect(facing[0]!.score).toBeGreaterThan(internal[0]!.score)
  })

  it('[FR-R105.4] classifies priorities', () => {
    const p = new SecurityPatchPrioritizer()
    const result = p.prioritize(
      [
        {
          id: 'v1',
          cvssScore: 9,
          epssScore: 0.9,
          affectedAssetIds: ['a'],
        },
      ],
      [{ id: 'a', criticality: 9, internetFacing: true }],
    )
    expect(result[0]!.priority).toBe('P0')
  })

  it('[FR-R105.1] handles unknown assets gracefully', () => {
    const p = new SecurityPatchPrioritizer()
    const result = p.prioritize(
      [
        {
          id: 'v1',
          cvssScore: 5,
          epssScore: 0.5,
          affectedAssetIds: ['unknown'],
        },
      ],
      [],
    )
    expect(result).toHaveLength(1)
  })

  it('[FR-R105.5] custom weights affect ranking', () => {
    const pDefault = new SecurityPatchPrioritizer()
    const pCvssHeavy = new SecurityPatchPrioritizer({ cvss: 1.0 })
    const vulns: Vulnerability[] = [
      {
        id: 'high-cvss',
        cvssScore: 10,
        epssScore: 0.1,
        affectedAssetIds: ['a'],
      },
      {
        id: 'high-epss',
        cvssScore: 5,
        epssScore: 1.0,
        affectedAssetIds: ['a'],
      },
    ]
    const assets: Asset[] = [
      { id: 'a', criticality: 5, internetFacing: false },
    ]
    const defaultRank = pDefault.prioritize(vulns, assets)
    const cvssRank = pCvssHeavy.prioritize(vulns, assets)
    expect(cvssRank[0]!.vuln.id).toBe('high-cvss')
    expect(defaultRank[0]).toBeDefined()
  })

  it('[FR-R105.3] score range 0-100', () => {
    const p = new SecurityPatchPrioritizer()
    const result = p.prioritize(
      [
        {
          id: 'v1',
          cvssScore: 10,
          epssScore: 1,
          affectedAssetIds: ['a'],
        },
      ],
      [{ id: 'a', criticality: 10, internetFacing: true }],
    )
    expect(result[0]!.score).toBeGreaterThanOrEqual(0)
    expect(result[0]!.score).toBeLessThanOrEqual(100)
  })

  it('[FR-R105.1] rationale contains key factors', () => {
    const p = new SecurityPatchPrioritizer()
    const result = p.prioritize(
      [
        {
          id: 'v1',
          cvssScore: 7,
          epssScore: 0.5,
          affectedAssetIds: ['a'],
        },
      ],
      [{ id: 'a', criticality: 6, internetFacing: true }],
    )
    expect(result[0]!.rationale).toContain('CVSS=7')
    expect(result[0]!.rationale).toContain('internet')
  })
})
