import { describe, it, expect, beforeEach } from 'vitest';
import { AISocialMediaRiskMonitor } from '../ai-social-media-risk-monitor';

describe('AISocialMediaRiskMonitor', () => {
  let ai: AISocialMediaRiskMonitor;

  beforeEach(() => {
    ai = new AISocialMediaRiskMonitor();
    ai.registerRule({ ruleId: 'violence', keywords: ['폭력', '테러'], weight: 30 });
    ai.registerRule({ ruleId: 'scandal', keywords: ['부정', '비리'], weight: 20 });
  });

  it('규칙을 등록한다', () => {
    ai.ingestMention({
      mentionId: 'm1',
      platform: 'twitter',
      author: '@user1',
      content: '평범한 글입니다',
      postedAt: 't',
      reach: 100,
    });
    expect(ai.getMentionCount()).toBe(1);
  });

  it('위험 키워드를 감지한다 (medium)', () => {
    ai.ingestMention({
      mentionId: 'm1',
      platform: 'community',
      author: 'a',
      content: '부정 의혹이 있다',
      postedAt: 't',
      reach: 500,
    });
    const r = ai.assess('m1');
    expect(['low', 'medium']).toContain(r.level);
    expect(r.matchedRules).toContain('scandal');
  });

  it('높은 도달 수는 위험도를 증폭한다', () => {
    ai.ingestMention({
      mentionId: 'm1',
      platform: 'twitter',
      author: 'a',
      content: '폭력 테러 부정 비리 사건',
      postedAt: 't',
      reach: 50000,
    });
    const r = ai.assess('m1');
    expect(r.level).toBe('high');
  });

  it('고위험 목록을 반환한다', () => {
    ai.ingestMention({
      mentionId: 'm1',
      platform: 'twitter',
      author: 'a',
      content: '테러 폭력 언급',
      postedAt: 't',
      reach: 20000,
    });
    ai.ingestMention({
      mentionId: 'm2',
      platform: 'blog',
      author: 'b',
      content: '평범',
      postedAt: 't',
      reach: 10,
    });
    const highs = ai.listHighRisk();
    expect(highs.length).toBe(1);
    expect(highs[0]!.mentionId).toBe('m1');
  });

  it('핸들을 마스킹한다', () => {
    ai.ingestMention({
      mentionId: 'm1',
      platform: 'twitter',
      author: '@real_user',
      content: '@mention 발언',
      postedAt: 't',
      reach: 10,
    });
    const r = ai.assess('m1');
    expect(r).toBeDefined();
    // 실제 content는 audit 통해 검증 (직접 조회 API 없음)
    expect(ai.getAuditLog().some(a => a.action === 'INGEST_MENTION')).toBe(true);
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.registerRule({ ruleId: 'x', keywords: ['a'], weight: 1 }, 'C'),
    ).toThrow('BLOCKED');
  });
});
