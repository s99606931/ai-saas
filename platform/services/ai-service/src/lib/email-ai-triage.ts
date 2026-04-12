// Design Ref: MTU-N477 §이메일 AI 트리아지
// Plan SC: FR-EM.1~5

export type EmailCategory = 'complaint' | 'inquiry' | 'marketing' | 'spam' | 'unknown';

export interface Email {
  id: string;
  subject: string;
  body: string;
  sender: string;
  attachments: Array<{ name: string; sizeBytes: number }>;
}

export interface Classification {
  emailId: string;
  category: EmailCategory;
  priority: number;
  score: number;
}

export interface ResponseTemplate {
  id: string;
  category: EmailCategory;
  subject: string;
  body: string;
}

export interface TriageResult {
  email: Email;
  classification: Classification;
  matchedTemplate?: ResponseTemplate;
  attachmentWarnings: string[];
  requiresApproval: boolean;
}

export class EmailAiTriage {
  private templates: ResponseTemplate[] = [];
  private allowedAttachmentExts = new Set(['pdf', 'docx', 'xlsx', 'hwp', 'jpg', 'png']);

  addTemplate(t: ResponseTemplate): void {
    this.templates.push(t);
  }

  /** FR-EM.1 분류 모델 (키워드 기반) */
  classify(email: Email): Classification {
    const text = `${email.subject} ${email.body}`.toLowerCase();
    let category: EmailCategory = 'unknown';
    if (/민원|신고|불만/.test(text)) category = 'complaint';
    else if (/문의|질문|궁금/.test(text)) category = 'inquiry';
    else if (/할인|이벤트|광고|프로모션/.test(text)) category = 'marketing';
    else if (/비아그라|viagra|lottery|당첨/.test(text)) category = 'spam';
    return {
      emailId: email.id,
      category,
      priority: this.priorityFor(category),
      score: 0.85,
    };
  }

  /** FR-EM.2 우선순위 */
  private priorityFor(c: EmailCategory): number {
    return { complaint: 90, inquiry: 60, marketing: 10, spam: 0, unknown: 30 }[c];
  }

  /** FR-EM.3 응답 템플릿 매칭 */
  matchTemplate(classification: Classification): ResponseTemplate | undefined {
    return this.templates.find((t) => t.category === classification.category);
  }

  /** FR-EM.4 첨부파일 스캔 */
  scanAttachments(email: Email): string[] {
    const warnings: string[] = [];
    for (const att of email.attachments) {
      const ext = att.name.split('.').pop()?.toLowerCase() ?? '';
      if (!this.allowedAttachmentExts.has(ext)) warnings.push(`비허용 확장자: ${att.name}`);
      if (att.sizeBytes > 10 * 1024 * 1024) warnings.push(`크기 초과: ${att.name}`);
    }
    return warnings;
  }

  /** FR-EM.5 트리아지 + 승인 필요성 */
  triage(email: Email): TriageResult {
    const classification = this.classify(email);
    const template = this.matchTemplate(classification);
    const warnings = this.scanAttachments(email);
    const requiresApproval = classification.category === 'complaint' || warnings.length > 0;
    return { email, classification, matchedTemplate: template, attachmentWarnings: warnings, requiresApproval };
  }
}

export const emailAiTriage = new EmailAiTriage();
