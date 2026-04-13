import { describe, it, expect, beforeEach } from 'vitest';
import { ApiResponseQualityEvaluator } from '../api-response-quality-evaluator';

describe('ApiResponseQualityEvaluator', () => {
  let evaluator: ApiResponseQualityEvaluator;

  beforeEach(() => {
    evaluator = new ApiResponseQualityEvaluator();
  });

  it('API 프로파일을 등록한다', () => {
    evaluator.registerApiProfile('api-1', '사용자 API', ['id', 'name', 'email'], 200);
    expect(evaluator.getAuditLog().some(l => l.action === 'REGISTER_API_PROFILE')).toBe(true);
  });

  it('완전한 응답에서 높은 점수를 반환한다', () => {
    evaluator.registerApiProfile('api-1', '사용자 API', ['id', 'name'], 200);
    const result = evaluator.evaluateResponse('api-1', { id: 1, name: 'Alice' }, 100);
    expect(result.qualityScore).toBe(100);
    expect(result.passed).toBe(true);
    expect(result.issues.length).toBe(0);
  });

  it('필수 필드 누락 시 이슈를 반환한다', () => {
    evaluator.registerApiProfile('api-1', '사용자 API', ['id', 'name', 'email'], 200);
    const result = evaluator.evaluateResponse('api-1', { id: 1 }, 100);
    expect(result.issues.some(i => i.includes('필수 필드 누락'))).toBe(true);
    expect(result.passed).toBe(false);
  });

  it('응답 지연 시 점수가 감소한다', () => {
    evaluator.registerApiProfile('api-1', 'API', [], 100);
    // fieldScore=50 (필드 없음), rtScore=50*(100/500)=10 → total=60 < 정상(100)
    const normalResult = evaluator.evaluateResponse('api-1', {}, 100);
    const slowResult = evaluator.evaluateResponse('api-1', {}, 500);
    expect(slowResult.qualityScore).toBeLessThan(normalResult.qualityScore);
  });

  it('저품질 이슈 목록을 반환한다', () => {
    evaluator.registerApiProfile('api-1', 'API', ['id'], 200);
    evaluator.evaluateResponse('api-1', {}, 100);
    const issues = evaluator.getQualityIssues('api-1');
    expect(issues.length).toBeGreaterThan(0);
  });

  it('C등급 평가를 차단한다', () => {
    evaluator.registerApiProfile('api-1', 'API', [], 200);
    expect(() => evaluator.evaluateResponse('api-1', {}, 100, 'C' as never)).toThrow('BLOCKED');
  });

  it('미등록 API 평가 시 오류를 던진다', () => {
    expect(() => evaluator.evaluateResponse('unknown', {}, 100)).toThrow('API 프로파일 미등록');
  });
});
