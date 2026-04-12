import { describe, it, expect } from 'vitest';
import { ReleaseNotesAi, type Commit } from '../release-notes-ai';

describe('ReleaseNotesAi', () => {
  const svc = new ReleaseNotesAi();

  const commits: Commit[] = [
    { hash: 'h1', message: 'feat(api): 신규 엔드포인트 추가', author: 'a', at: '' },
    { hash: 'h2', message: 'fix(auth): 토큰 만료 버그 수정', author: 'b', at: '' },
    { hash: 'h3', message: 'feat(db)!: 마이그레이션 재구성', author: 'c', at: '' },
  ];

  it('FR-RN.1 파싱', () => {
    const p = svc.parseCommit(commits[0]!);
    expect(p?.type).toBe('feat');
    expect(p?.scope).toBe('api');
  });

  it('FR-RN.2 분류', () => {
    const c = svc.categorize(commits);
    expect(c.length).toBe(3);
  });

  it('FR-RN.3 다음 버전 (breaking)', () => {
    const c = svc.categorize(commits);
    const next = svc.estimateNextVersion('1.2.3', c);
    expect(next).toBe('2.0.0');
  });

  it('FR-RN.4 노트 생성', () => {
    const c = svc.categorize(commits);
    const notes = svc.generateNotes('2.0.0', c);
    expect(notes.breakingChanges.length).toBe(1);
  });

  it('FR-RN.5 CHANGELOG', () => {
    const c = svc.categorize(commits);
    const notes = svc.generateNotes('2.0.0', c);
    const md = svc.toMarkdown(notes);
    expect(md).toContain('Breaking');
    expect(md).toContain('feat');
  });
});
