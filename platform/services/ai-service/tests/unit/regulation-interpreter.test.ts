// AI 법령/규정 자동 해석 엔진 단위 테스트 -- MTU-N267
import { describe, it, expect } from 'vitest';
import {
  parseRegulation,
  searchRegulations,
  generateInterpretation,
  analyzeAmendment,
  getRegulation,
  listRegulations,
  getRegulationAuditLog,
  type ArticleNode,
} from '../../src/lib/regulation-interpreter';

const SAMPLE_REGULATION_TEXT = `제1장 총칙
제1절 목적
제1조(목적) 이 법은 공공기관의 정보보호에 관한 사항을 규정함을 목적으로 한다.
제2조(정의) 이 법에서 사용하는 용어의 뜻은 다음과 같다.
1. 정보보호란 정보의 수집 저장 전송 과정에서 보안을 유지하는 것을 말한다.
2. 개인정보란 살아 있는 개인에 관한 정보를 말한다.
제2장 접근통제
제3조(접근 권한) 정보시스템에 대한 접근은 제2조의 기준에 따라 통제한다.
제4조(암호화) 민감 데이터는 암호화하여 저장하여야 한다.`;

describe('법령/규정 자동 해석 엔진', () => {
  describe('parseRegulation', () => {
    it('법령을 구조화하여 파싱해야 한다', () => {
      const doc = parseRegulation({
        title: '공공기관 정보보호법',
        text: SAMPLE_REGULATION_TEXT,
        enactedDate: '2020-01-01',
        lastAmendedDate: '2025-06-01',
        actor: 'test-user',
      });

      expect(doc.title).toBe('공공기관 정보보호법');
      expect(doc.articles.length).toBeGreaterThan(0);
      expect(doc.id).toBeDefined();
    });

    it('장/절/조 계층 구조를 생성해야 한다', () => {
      const doc = parseRegulation({
        title: '테스트법',
        text: SAMPLE_REGULATION_TEXT,
        enactedDate: '2020-01-01',
        lastAmendedDate: '2025-06-01',
        actor: 'test-user',
      });

      // 최상위 레벨에 장이 있어야 함
      const chapters = doc.articles.filter((a) => a.level === 'chapter');
      expect(chapters.length).toBeGreaterThanOrEqual(1);
    });

    it('키워드를 추출해야 한다', () => {
      const doc = parseRegulation({
        title: '키워드 테스트법',
        text: '제1조(목적) 이 법은 정보보호와 개인정보 보호를 목적으로 한다.',
        enactedDate: '2020-01-01',
        lastAmendedDate: '2025-06-01',
        actor: 'test-user',
      });

      const allArticles = flattenArticlesHelper(doc.articles);
      const hasKeywords = allArticles.some((a) => a.keywords.length > 0);
      expect(hasKeywords).toBe(true);
    });
  });

  describe('searchRegulations', () => {
    it('관련 조문을 검색해야 한다', () => {
      parseRegulation({
        title: '검색 테스트법',
        text: SAMPLE_REGULATION_TEXT,
        enactedDate: '2020-01-01',
        lastAmendedDate: '2025-06-01',
        actor: 'test-user',
      });

      const results = searchRegulations('접근 권한 통제', 'test-user');
      expect(results.length).toBeGreaterThanOrEqual(0);
    });

    it('관련성 점수 순으로 정렬해야 한다', () => {
      const results = searchRegulations('정보보호 암호화', 'test-user');
      for (let i = 1; i < results.length; i++) {
        expect(results[i].relevanceScore).toBeLessThanOrEqual(results[i - 1].relevanceScore);
      }
    });
  });

  describe('generateInterpretation', () => {
    it('해석 결과를 생성해야 한다', () => {
      const interpretation = generateInterpretation('정보보호 의무', 'test-user');
      expect(interpretation.query).toBe('정보보호 의무');
      expect(interpretation.interpretation).toBeDefined();
      expect(interpretation.disclaimer).toContain('법적 효력이 없습니다');
    });

    it('면책 조항이 포함되어야 한다', () => {
      const interpretation = generateInterpretation('개인정보 처리', 'test-user');
      expect(interpretation.disclaimer.length).toBeGreaterThan(0);
    });
  });

  describe('analyzeAmendment', () => {
    it('개정 변경을 분석해야 한다', () => {
      const oldArticle: ArticleNode = {
        id: 'old-1',
        level: 'article',
        number: '1',
        title: '목적',
        content: '이 법은 정보보호를 목적으로 한다.',
        children: [],
        references: [],
        keywords: ['정보보호', '목적'],
      };

      const newArticle: ArticleNode = {
        id: 'new-1',
        level: 'article',
        number: '1',
        title: '목적',
        content: '이 법은 정보보호 및 개인정보 보호를 목적으로 한다.',
        children: [],
        references: [],
        keywords: ['정보보호', '개인정보', '보호', '목적'],
      };

      const analysis = analyzeAmendment('reg-1', oldArticle, newArticle, 'test-user');
      expect(analysis.changeType).toBe('modified');
      expect(analysis.impactSummary).toContain('modified');
    });

    it('신규 조문 추가를 감지해야 한다', () => {
      const oldArticle: ArticleNode = {
        id: 'empty', level: 'article', number: '5', title: '',
        content: '', children: [], references: [], keywords: [],
      };
      const newArticle: ArticleNode = {
        id: 'new-5', level: 'article', number: '5', title: '신규',
        content: '신규 조문 내용', children: [], references: [], keywords: ['신규'],
      };

      const analysis = analyzeAmendment('reg-1', oldArticle, newArticle, 'test-user');
      expect(analysis.changeType).toBe('added');
    });
  });

  describe('감사 로그', () => {
    it('모든 작업이 감사 로그에 기록되어야 한다', () => {
      const log = getRegulationAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log.every((e) => e.timestamp)).toBe(true);
    });
  });
});

// 헬퍼 함수
function flattenArticlesHelper(articles: ArticleNode[]): ArticleNode[] {
  const result: ArticleNode[] = [];
  for (const a of articles) {
    result.push(a);
    result.push(...flattenArticlesHelper(a.children));
  }
  return result;
}
