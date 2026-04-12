// Plan SC: FR-R88.1~5
import { describe, it, expect } from 'vitest';
import {
  createPetitionIntentHierarchyClassifier,
  type CategoryNode,
} from '../petition-intent-hierarchy-classifier';

function taxonomy(): CategoryNode[] {
  return [
    {
      id: 'daily',
      label: '생활민원',
      keywords: ['생활', '일상'],
      children: [
        {
          id: 'parking',
          label: '주차',
          keywords: ['주차', '견인'],
          children: [
            { id: 'violation', label: '위반', keywords: ['위반', '과태료'] },
            { id: 'apply', label: '신청', keywords: ['신청', '발급'] },
          ],
        },
        {
          id: 'noise',
          label: '소음',
          keywords: ['소음', '시끄러'],
        },
      ],
    },
    {
      id: 'business',
      label: '기업민원',
      keywords: ['기업', '사업자'],
    },
  ];
}

describe('PetitionIntentHierarchyClassifier', () => {
  it('FR-R88.1: registers taxonomy', () => {
    const c = createPetitionIntentHierarchyClassifier();
    c.registerTaxonomy(taxonomy());
    expect(c.getAuditLog()[0]?.action).toBe('REGISTER');
  });

  it('FR-R88.2~3: classifies to 3 levels (생활/주차/위반)', () => {
    const c = createPetitionIntentHierarchyClassifier();
    c.registerTaxonomy(taxonomy());
    const res = c.classify('생활 속 주차 위반 신고 접수');
    expect(res.path).toEqual(['daily', 'parking', 'violation']);
    expect(res.labels).toEqual(['생활민원', '주차', '위반']);
    expect(res.unknown).toBe(false);
  });

  it('FR-R88.3: classifies mid-level only when no leaf match', () => {
    const c = createPetitionIntentHierarchyClassifier();
    c.registerTaxonomy(taxonomy());
    const res = c.classify('생활 속 소음이 시끄러워요');
    expect(res.path).toContain('noise');
  });

  it('FR-R88.4: returns unknown for low-score text', () => {
    const c = createPetitionIntentHierarchyClassifier(0.5);
    c.registerTaxonomy(taxonomy());
    const res = c.classify('뜬금없는 엉뚱한 문의');
    expect(res.unknown).toBe(true);
  });

  it('FR-R88.5: audit log records CLASSIFY', () => {
    const c = createPetitionIntentHierarchyClassifier();
    c.registerTaxonomy(taxonomy());
    c.classify('주차 위반');
    expect(c.getAuditLog().some((e) => e.action === 'CLASSIFY')).toBe(true);
  });

  it('empty taxonomy returns unknown', () => {
    const c = createPetitionIntentHierarchyClassifier();
    const res = c.classify('anything');
    expect(res.path.length).toBe(0);
    expect(res.unknown).toBe(true);
  });
});
