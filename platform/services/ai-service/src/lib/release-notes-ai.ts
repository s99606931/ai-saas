// Design Ref: MTU-N490 §릴리스 노트 AI
// Plan SC: FR-RN.1~5

export interface Commit {
  hash: string;
  message: string;
  author: string;
  at: string;
}

export type ChangeType = 'feat' | 'fix' | 'refactor' | 'docs' | 'chore' | 'test' | 'perf';

export interface Categorized {
  hash: string;
  type: ChangeType;
  scope?: string;
  summary: string;
  impact: 'breaking' | 'major' | 'minor' | 'patch';
}

export interface ReleaseNotes {
  version: string;
  summary: string;
  sections: Record<ChangeType, Categorized[]>;
  breakingChanges: string[];
}

export class ReleaseNotesAi {
  /** FR-RN.1 Conventional Commit 파싱 */
  parseCommit(commit: Commit): Categorized | undefined {
    const match = commit.message.match(/^(\w+)(?:\(([^)]+)\))?(!)?: (.+)$/);
    if (!match) return undefined;
    const [, typeRaw, scope, breaking, summary] = match;
    const validTypes: ChangeType[] = ['feat', 'fix', 'refactor', 'docs', 'chore', 'test', 'perf'];
    if (!validTypes.includes(typeRaw as ChangeType)) return undefined;
    const type = typeRaw as ChangeType;
    let impact: Categorized['impact'] = 'patch';
    if (breaking || /BREAKING CHANGE/.test(commit.message)) impact = 'breaking';
    else if (type === 'feat') impact = 'minor';
    else if (type === 'perf') impact = 'patch';
    return { hash: commit.hash, type, scope, summary: summary ?? '', impact };
  }

  /** FR-RN.2 분류 */
  categorize(commits: Commit[]): Categorized[] {
    return commits.map((c) => this.parseCommit(c)).filter((c): c is Categorized => c !== undefined);
  }

  /** FR-RN.3 영향도 추정 (시맨틱 버전) */
  estimateNextVersion(current: string, changes: Categorized[]): string {
    const parts = current.split('.').map(Number);
    const major = parts[0] ?? 0;
    const minor = parts[1] ?? 0;
    const patch = parts[2] ?? 0;
    if (changes.some((c) => c.impact === 'breaking')) return `${major + 1}.0.0`;
    if (changes.some((c) => c.impact === 'minor')) return `${major}.${minor + 1}.0`;
    return `${major}.${minor}.${patch + 1}`;
  }

  /** FR-RN.4 사용자 친화 요약 */
  generateNotes(version: string, changes: Categorized[]): ReleaseNotes {
    const sections: Record<ChangeType, Categorized[]> = {
      feat: [], fix: [], refactor: [], docs: [], chore: [], test: [], perf: [],
    };
    for (const c of changes) sections[c.type].push(c);
    const featCount = sections.feat.length;
    const fixCount = sections.fix.length;
    const summary = `v${version}: 신규 기능 ${featCount}개, 버그 수정 ${fixCount}개`;
    const breakingChanges = changes.filter((c) => c.impact === 'breaking').map((c) => c.summary);
    return { version, summary, sections, breakingChanges };
  }

  /** FR-RN.5 CHANGELOG 포맷 */
  toMarkdown(notes: ReleaseNotes): string {
    const lines: string[] = [`## v${notes.version}`, '', notes.summary, ''];
    if (notes.breakingChanges.length > 0) {
      lines.push(`### ⚠️ Breaking Changes`);
      notes.breakingChanges.forEach((b) => lines.push(`- ${b}`));
      lines.push('');
    }
    for (const [type, items] of Object.entries(notes.sections)) {
      if (items.length === 0) continue;
      lines.push(`### ${type}`);
      items.forEach((i) => lines.push(`- ${i.summary}${i.scope ? ` (${i.scope})` : ''}`));
      lines.push('');
    }
    return lines.join('\n');
  }
}

export const releaseNotesAi = new ReleaseNotesAi();
