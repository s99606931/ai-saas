import { describe, it, expect, beforeEach } from 'vitest';
import { FarmlandUseComplianceAI } from '../farmland-use-compliance-ai';

describe('FarmlandUseComplianceAI', () => {
  let ai: FarmlandUseComplianceAI;

  beforeEach(() => {
    ai = new FarmlandUseComplianceAI();
  });

  it('필지를 등록한다', () => {
    ai.registerParcel({
      parcelId: 'p1',
      areaM2: 3000,
      designatedUse: 'cultivation',
      actualUse: 'cultivation',
      lastInspectedAt: '2026-04-01',
    });
    expect(ai.getParcel('p1')?.areaM2).toBe(3000);
  });

  it('준수 상태를 판정한다', () => {
    ai.registerParcel({
      parcelId: 'p1',
      areaM2: 1000,
      designatedUse: 'cultivation',
      actualUse: 'cultivation',
      lastInspectedAt: '2026-04-01',
    });
    const r = ai.evaluate('p1');
    expect(r.compliant).toBe(true);
  });

  it('불법 건축물을 고위험으로 분류한다', () => {
    ai.registerParcel({
      parcelId: 'p1',
      areaM2: 500,
      designatedUse: 'cultivation',
      actualUse: 'illegal_structure',
      lastInspectedAt: '2026-04-01',
    });
    const r = ai.evaluate('p1');
    expect(r.riskLevel).toBe('high');
  });

  it('휴경지를 중위험으로 분류한다', () => {
    ai.registerParcel({
      parcelId: 'p1',
      areaM2: 500,
      designatedUse: 'cultivation',
      actualUse: 'fallow',
      lastInspectedAt: '2026-04-01',
    });
    const r = ai.evaluate('p1');
    expect(r.riskLevel).toBe('medium');
  });

  it('고위험 필지 목록을 조회한다', () => {
    ai.registerParcel({
      parcelId: 'p1',
      areaM2: 500,
      designatedUse: 'cultivation',
      actualUse: 'illegal_structure',
      lastInspectedAt: '2026-04-01',
    });
    ai.registerParcel({
      parcelId: 'p2',
      areaM2: 500,
      designatedUse: 'cultivation',
      actualUse: 'cultivation',
      lastInspectedAt: '2026-04-01',
    });
    expect(ai.listHighRisk()).toEqual(['p1']);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerParcel(
        {
          parcelId: 'p1',
          areaM2: 100,
          designatedUse: 'cultivation',
          actualUse: 'cultivation',
          lastInspectedAt: '2026-04-01',
        },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
