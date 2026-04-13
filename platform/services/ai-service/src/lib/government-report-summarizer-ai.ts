// Design Ref: §정부 보고서 요약 AI — 섹션 분리·핵심 문장 추출
// Plan SC: FR-R538.1~6

const DATA_GRADE_BLOCK = ['C', 'S'] as const;
type DataGrade = 'C' | 'S' | 'O';

function blockClassifiedData(grade: DataGrade): void {
  if ((DATA_GRADE_BLOCK as readonly string[]).includes(grade)) {
    throw new Error(`BLOCKED: ${grade}등급 데이터는 AI API 전송 금지 (N2SF N-05)`);
  }
}

export interface Report {
  reportId: string;
  title: string;
  body: string;
  publishedAt: string;
  department: string;
}

export interface Section {
  heading: string;
  content: string;
}

export interface Summary {
  reportId: string;
  sectionCount: number;
  sentences: string[];
  keywords: Array<{ term: string; count: number }>;
}

interface AuditEntry {
  timestamp: string;
  action: string;
  detail: Record<string, unknown>;
}

function maskReport(text: string): string {
  return text
    .replace(/\d{6}[-\s]?\d{7}/g, '[RRN_MASKED]')
    .replace(/[\w.+-]+@[\w-]+\.[\w.-]+/g, '[EMAIL_MASKED]');
}

const KOREAN_STOPWORDS = new Set([
  '그리고', '그러나', '또한', '이것', '저것', '이다', '있다', '하다', '것은', '것을',
  '수', '등', '및', '또는', '그', '저', '이', '저', '는', '은', '을', '를', '의',
]);

export class GovernmentReportSummarizerAI {
  private readonly reports = new Map<string, Report>();
  private readonly auditLog: AuditEntry[] = [];

  private append(action: string, detail: Record<string, unknown>): void {
    this.auditLog.push({ timestamp: new Date().toISOString(), action, detail });
  }

  // Plan SC: FR-R538.1
  ingestReport(report: Report, grade: DataGrade = 'O'): void {
    blockClassifiedData(grade);
    if (report.body.trim().length === 0) throw new Error('보고서 본문이 비어 있습니다');
    this.reports.set(report.reportId, {
      ...report,
      title: maskReport(report.title),
      body: maskReport(report.body),
    });
    this.append('INGEST_REPORT', { reportId: report.reportId });
  }

  // Plan SC: FR-R538.2
  splitSections(reportId: string): Section[] {
    const report = this.reports.get(reportId);
    if (!report) throw new Error(`보고서 미등록: ${reportId}`);

    const lines = report.body.split('\n');
    const sections: Section[] = [];
    let current: Section | null = null;

    for (const raw of lines) {
      const line = raw.trim();
      if (line.length === 0) continue;
      if (/^(#+\s|[0-9]+\.\s|제\s?[0-9]+\s?[장절조])/.test(line)) {
        if (current) sections.push(current);
        current = { heading: line, content: '' };
      } else if (current) {
        current.content += (current.content ? '\n' : '') + line;
      } else {
        current = { heading: '서문', content: line };
      }
    }
    if (current) sections.push(current);
    this.append('SPLIT_SECTIONS', { reportId, count: sections.length });
    return sections;
  }

  // Plan SC: FR-R538.3
  summarize(reportId: string, topSentences = 3): Summary {
    const report = this.reports.get(reportId);
    if (!report) throw new Error(`보고서 미등록: ${reportId}`);

    const sections = this.splitSections(reportId);
    const allSentences = report.body
      .split(/[.!?。]/)
      .map(s => s.trim())
      .filter(s => s.length > 10);

    // 단어 빈도 기반 점수
    const freq = new Map<string, number>();
    for (const s of allSentences) {
      const words = s.split(/\s+/).filter(w => w.length > 1 && !KOREAN_STOPWORDS.has(w));
      for (const w of words) freq.set(w, (freq.get(w) ?? 0) + 1);
    }

    const scoreSentence = (s: string): number => {
      const words = s.split(/\s+/).filter(w => w.length > 1);
      return words.reduce((sum, w) => sum + (freq.get(w) ?? 0), 0);
    };

    const ranked = [...allSentences]
      .map(s => ({ s, score: scoreSentence(s) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, topSentences)
      .map(r => r.s);

    const keywords = Array.from(freq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([term, count]) => ({ term, count }));

    const summary: Summary = {
      reportId,
      sectionCount: sections.length,
      sentences: ranked,
      keywords,
    };
    this.append('SUMMARIZE', { reportId, topSentences });
    return summary;
  }

  // Plan SC: FR-R538.4
  listReportsByDepartment(department: string): Report[] {
    return Array.from(this.reports.values()).filter(r => r.department === department).map(r => ({ ...r }));
  }

  // Plan SC: FR-R538.5
  getReportCount(): number {
    return this.reports.size;
  }

  // Plan SC: FR-R538.6
  getAuditLog(): AuditEntry[] {
    return [...this.auditLog];
  }
}
