import { describe, it, expect, beforeEach } from 'vitest';
import { OperationsManualGeneratorAI } from '../operations-manual-generator-ai';

describe('OperationsManualGeneratorAI', () => {
  let generator: OperationsManualGeneratorAI;

  beforeEach(() => {
    generator = new OperationsManualGeneratorAI();
  });

  it('절차를 등록한다', () => {
    generator.registerProcedure('p1', '서버 재시작', '인프라', 1);
    expect(generator.getAuditLog().some(l => l.action === 'REGISTER_PROCEDURE')).toBe(true);
  });

  it('단계를 추가한다', () => {
    generator.registerProcedure('p1', '서버 재시작', '인프라', 1);
    generator.addStep('p1', 1, '서비스 중지', '데이터 백업 후 진행');
    expect(generator.getAuditLog().some(l => l.action === 'ADD_STEP')).toBe(true);
  });

  it('카테고리별 매뉴얼을 생성한다', () => {
    generator.registerProcedure('p1', '서버 재시작', '인프라', 1);
    generator.registerProcedure('p2', '백업 수행', '데이터', 1);
    generator.addStep('p1', 1, '중지');
    const sections = generator.generateManual('인프라');
    expect(sections.length).toBe(1);
    expect(sections[0]!.title).toBe('서버 재시작');
  });

  it('전체 매뉴얼을 priority 순으로 생성한다', () => {
    generator.registerProcedure('p2', '백업', '데이터', 2);
    generator.registerProcedure('p1', '점검', '보안', 1);
    const sections = generator.generateManual();
    expect(sections[0]!.procedureId).toBe('p1');
  });

  it('목차를 생성한다', () => {
    generator.registerProcedure('p1', '서버 재시작', '인프라', 1);
    generator.registerProcedure('p2', '백업 수행', '인프라', 2);
    const toc = generator.generateTOC();
    expect(toc.some(t => t.category === '인프라')).toBe(true);
    const infraToc = toc.find(t => t.category === '인프라')!;
    expect(infraToc.procedures.length).toBe(2);
  });

  it('C등급 단계 추가를 차단한다', () => {
    generator.registerProcedure('p1', '절차', '카테고리', 1);
    expect(() => generator.addStep('p1', 1, '설명', undefined, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 절차 단계 추가 시 오류를 던진다', () => {
    expect(() => generator.addStep('unknown', 1, '설명')).toThrow('절차 미등록');
  });
});
