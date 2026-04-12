/**
 * Unit tests for Adaptive UI Generator — SVC-AI-ADV-R139
 */

import { describe, it, expect } from 'vitest'
import {
  AdaptiveUiGenerator,
  type BehaviorEvent,
  type ComponentSpec,
} from '../adaptive-ui-generator'

const components: ComponentSpec[] = [
  { id: 'header', required: true, defaultOrder: 0 },
  { id: 'notice', defaultOrder: 1 },
  { id: 'stats', defaultOrder: 2 },
  { id: 'ads', defaultOrder: 3 },
]

describe('SVC-AI-ADV-R139 AdaptiveUiGenerator', () => {
  it('[FR-R139.1] ingests click events', () => {
    const g = new AdaptiveUiGenerator()
    const events: BehaviorEvent[] = [
      { componentId: 'stats', type: 'click', value: 1, ts: 1000 },
      { componentId: 'stats', type: 'click', value: 1, ts: 2000 },
    ]
    g.ingest(events)
    expect(g.computeScore('stats')).toBe(6)
  })

  it('[FR-R139.2] dwell contributes 0.1/sec', () => {
    const g = new AdaptiveUiGenerator()
    g.ingest([{ componentId: 'notice', type: 'dwell', value: 50, ts: 1000 }])
    expect(g.computeScore('notice')).toBeCloseTo(5, 5)
  })

  it('[FR-R139.2] scroll contributes 0.5/unit', () => {
    const g = new AdaptiveUiGenerator()
    g.ingest([{ componentId: 'stats', type: 'scroll', value: 10, ts: 1000 }])
    expect(g.computeScore('stats')).toBe(5)
  })

  it('[FR-R139.3] orders by score descending', () => {
    const g = new AdaptiveUiGenerator()
    g.ingest([
      { componentId: 'stats', type: 'click', value: 5, ts: 1000 },
      { componentId: 'notice', type: 'click', value: 1, ts: 1000 },
    ])
    const spec = g.generate(components)
    const order = spec.components.map((c) => c.id)
    expect(order.indexOf('stats')).toBeLessThan(order.indexOf('notice'))
  })

  it('[FR-R139.4] required components always visible', () => {
    const g = new AdaptiveUiGenerator()
    // header는 이벤트 없음
    g.ingest([{ componentId: 'stats', type: 'click', value: 3, ts: 1000 }])
    const spec = g.generate(components)
    const header = spec.components.find((c) => c.id === 'header')
    expect(header?.visible).toBe(true)
  })

  it('[FR-R139.4] low-score non-required component hidden', () => {
    const g = new AdaptiveUiGenerator({ hideThreshold: 1 })
    g.ingest([{ componentId: 'stats', type: 'click', value: 10, ts: 1000 }])
    const spec = g.generate(components)
    const ads = spec.components.find((c) => c.id === 'ads')
    expect(ads?.visible).toBe(false)
    expect(ads?.score).toBe(0)
  })

  it('[FR-R139.3] generates spec with generatedAt', () => {
    const g = new AdaptiveUiGenerator({ now: () => 5000 })
    const spec = g.generate(components)
    expect(spec.generatedAt).toBe(5000)
    expect(spec.components).toHaveLength(4)
  })

  it('[FR-R139.5] getAuditLog records ingest and generate', () => {
    const g = new AdaptiveUiGenerator({ now: () => 7000 })
    g.ingest([{ componentId: 'stats', type: 'click', value: 1, ts: 1000 }])
    g.generate(components)
    const logs = g.getAuditLog()
    expect(logs).toHaveLength(2)
    expect(logs[0]!.event).toBe('ui.events.ingested')
    expect(logs[1]!.event).toBe('ui.layout.generated')
  })

  it('[FR-R139.6] blocks C-grade on ingest', () => {
    const g = new AdaptiveUiGenerator()
    expect(() => g.ingest([], 'C')).toThrow(/BLOCKED/)
  })

  it('[FR-R139.6] blocks S-grade on generate', () => {
    const g = new AdaptiveUiGenerator()
    expect(() => g.generate(components, 'S')).toThrow(/BLOCKED/)
  })

  it('[FR-R139.2] handles unknown componentId score as 0', () => {
    const g = new AdaptiveUiGenerator()
    expect(g.computeScore('unknown')).toBe(0)
  })
})
