// Design Ref: §AI 소셜미디어 리스크 모니터 — 공공기관 소셜 멘션 위험 탐지
// Plan SC: FR-R537.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export type RiskLevel = 'none' | 'low' | 'medium' | 'high';
export type Platform = 'twitter' | 'facebook' | 'instagram' | 'blog' | 'community';

export interface Mention {
  mentionId: string;
  platform: Platform;
  author: string;
  content: string;
  postedAt: string;
  reach: number;
}

export interface RiskRule {
  ruleId: string;
  keywords: string[];
  weight: number;
}

export interface RiskAssessment {
  mentionId: string;
  level: RiskLevel;
  score: number;
  matchedRules: string[];
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function maskHandle(text: string): string {
  return text.replace(/@[\w가-힣._-]+/g, '[HANDLE_MASKED]');
}

export class AISocialMediaRiskMonitor {
  private readonly rules = new Map<string, RiskRule>();
  private readonly mentions = new Map<string, Mention>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R537.1
  registerRule(rule: RiskRule, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (rule.keywords.length === 0) throw new Error('키워드가 비어 있습니다');
    if (rule.weight <= 0) throw new Error('가중치는 양수여야 합니다');
    this.rules.set(rule.ruleId, { ...rule, keywords: [...rule.keywords] });
    this.append('REGISTER_RULE', { ruleId: rule.ruleId });
  }

  // Plan SC: FR-R537.2
  ingestMention(mention: Mention, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (mention.reach < 0) throw new Error('도달 수는 음수일 수 없습니다');
    this.mentions.set(mention.mentionId, {
      ...mention,
      author: '[AUTHOR_MASKED]',
      content: maskHandle(mention.content),
    });
    this.append('INGEST_MENTION', { mentionId: mention.mentionId, platform: mention.platform });
  }

  // Plan SC: FR-R537.3
  assess(mentionId: string): RiskAssessment {
    const mention = this.mentions.get(mentionId);
    if (!mention) throw new Error(`멘션 미등록: ${mentionId}`);

    const text = mention.content.toLowerCase();
    const matched: string[] = [];
    let score = 0;

    for (const rule of this.rules.values()) {
      const hits = rule.keywords.filter(kw => text.includes(kw.toLowerCase())).length;
      if (hits > 0) {
        score += rule.weight * hits;
        matched.push(rule.ruleId);
      }
    }

    // 도달 수 영향
    if (mention.reach >= 10000) score *= 2;
    else if (mention.reach >= 1000) score *= 1.5;

    let level: RiskLevel = 'none';
    if (score >= 80) level = 'high';
    else if (score >= 40) level = 'medium';
    else if (score >= 10) level = 'low';

    this.append('ASSESS', { mentionId, level, score });
    return { mentionId, level, score: Math.round(score), matchedRules: matched };
  }

  // Plan SC: FR-R537.4
  listHighRisk(): RiskAssessment[] {
    const results: RiskAssessment[] = [];
    for (const mentionId of this.mentions.keys()) {
      const r = this.assess(mentionId);
      if (r.level === 'high' || r.level === 'medium') results.push(r);
    }
    return results;
  }

  // Plan SC: FR-R537.5
  getMentionCount(): number {
    return this.mentions.size;
  }

  // Plan SC: FR-R537.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
