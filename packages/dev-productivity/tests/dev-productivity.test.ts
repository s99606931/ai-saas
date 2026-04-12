/**
 * 개발자 생산성 테스트
 */

import {
  ServiceSkeletonGenerator,
  TechDebtScorer,
  DependencyAutoPrGenerator,
  ReleaseNotesGenerator,
} from '../src/index';

describe('ServiceSkeletonGenerator', () => {
  it('routes + test 파일 생성', () => {
    const g = new ServiceSkeletonGenerator();
    const r = g.generate({
      serviceName: 'svcA',
      namespace: 'app',
      routes: [
        { method: 'GET', path: '/items', schema: 'Item' },
        { method: 'POST', path: '/items', schema: 'Item' },
      ],
    });
    expect(r.files.length).toBe(2);
    expect(r.files[0]?.content).toContain('svcARoutes');
    expect(r.files[1]?.content).toContain('it.todo');
  });
});

describe('TechDebtScorer', () => {
  const s = new TechDebtScorer();

  it('낮은 부채 점수', () => {
    const score = s.score({
      filePath: '/x',
      linesOfCode: 100,
      complexity: 5,
      duplicateRatio: 0.01,
      testCoverage: 0.9,
      lastModified: new Date().toISOString(),
    });
    expect(score).toBeLessThan(20);
  });

  it('높은 부채 점수 (모든 지표 나쁨)', () => {
    const score = s.score({
      filePath: '/x',
      linesOfCode: 1500,
      complexity: 30,
      duplicateRatio: 0.3,
      testCoverage: 0.2,
      lastModified: '2020-01-01',
    });
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it('prioritize: P0/P1/P2/P3 매트릭스', () => {
    const r = s.prioritize([
      {
        filePath: '/bad',
        linesOfCode: 1500,
        complexity: 30,
        duplicateRatio: 0.3,
        testCoverage: 0.2,
        lastModified: '2020-01-01',
      },
      {
        filePath: '/good',
        linesOfCode: 50,
        complexity: 3,
        duplicateRatio: 0,
        testCoverage: 0.95,
        lastModified: new Date().toISOString(),
      },
    ]);
    expect(r[0]?.priority).toBe('P0');
    expect(r[0]?.filePath).toBe('/bad');
    expect(r[1]?.priority).toBe('P3');
  });
});

describe('DependencyAutoPrGenerator', () => {
  const g = new DependencyAutoPrGenerator();

  it('PR 생성: 제목 + 본문 + 변경', () => {
    const pr = g.generate([
      {
        name: 'lodash',
        currentVersion: '4.17.20',
        fixedVersion: '4.17.21',
        severity: 'critical',
        cve: 'CVE-2021-23337',
      },
    ]);
    expect(pr.title).toContain('1개');
    expect(pr.body).toContain('CVE-2021-23337');
    expect(pr.body).toContain('1개 critical/high 포함');
    expect(pr.changes.length).toBe(1);
    expect(pr.branchName).toMatch(/^fix\/deps-/);
  });

  it('빈 vulns', () => {
    const pr = g.generate([]);
    expect(pr.changes.length).toBe(0);
    expect(pr.body).toContain('0개 critical/high');
  });
});

describe('ReleaseNotesGenerator', () => {
  const g = new ReleaseNotesGenerator();

  it('parse: feat + scope + breaking', () => {
    const r = g.parse('feat(api)!: 새로운 엔드포인트', 'sha1');
    expect(r?.type).toBe('feat');
    expect(r?.scope).toBe('api');
    expect(r?.breaking).toBe(true);
  });

  it('parse: 잘못된 형식 → null', () => {
    expect(g.parse('random message', 'sha')).toBeNull();
  });

  it('parse: 미지원 type → null', () => {
    expect(g.parse('unknown(x): 변경', 'sha')).toBeNull();
  });

  it('generate: 모든 섹션 포함', () => {
    const md = g.generate('v1.0.0', [
      { sha: 'a', type: 'feat', scope: 'api', subject: '신규 API', breaking: false },
      { sha: 'b', type: 'fix', scope: 'auth', subject: '로그인 버그', breaking: false },
      { sha: 'c', type: 'refactor', subject: '리팩토링', breaking: false },
      { sha: 'd', type: 'feat', subject: '주요 변경', breaking: true },
    ]);
    expect(md).toContain('v1.0.0');
    expect(md).toContain('파괴적 변경');
    expect(md).toContain('신규 기능');
    expect(md).toContain('버그 수정');
    expect(md).toContain('리팩토링');
  });

  it('generate: 빈 commits', () => {
    const md = g.generate('v0.1.0', []);
    expect(md).toContain('v0.1.0');
  });
});
