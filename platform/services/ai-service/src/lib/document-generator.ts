// 공문서 자동 생성기 — FR-ADV13.1~FR-ADV13.6
// Design Ref: SVC-AI-ADV-R13 DESIGN §1~§3
// CSAP: D-12 시스템 개발 보안, D-08 접근 통제
// N2SF: N-05 O등급 데이터만 처리

import type { LLMProvider, LLMMessage } from './llm-provider.js';
import { maskPII } from './pii-masking.js';

// ── 타입 정의 ────────────────────────────────────────────────────────────────

/** 공문서 양식 유형 — FR-ADV13.4 */
export type OfficialDocumentType =
  | 'cooperation'  // 협조전
  | 'report'       // 보고서
  | 'minutes'      // 회의록
  | 'draft'        // 기안문
  | 'notice';      // 공고문

/** 공문서 양식 유형 한글 매핑 */
const DOC_TYPE_LABELS: Record<OfficialDocumentType, string> = {
  cooperation: '협조전',
  report: '보고서',
  minutes: '회의록',
  draft: '기안문',
  notice: '공고문',
};

/** 문서 생성 입력 */
export interface DocumentGenerationInput {
  /** 양식 유형 */
  type: OfficialDocumentType;
  /** 발신 기관 */
  senderOrg: string;
  /** 수신 기관 */
  recipientOrg: string;
  /** 제목 */
  title: string;
  /** AI에게 보내는 본문 생성 지시사항 */
  instruction: string;
  /** 참조 자료 (컨텍스트) */
  references?: string[];
  /** 추가 변수 (양식별 커스텀) */
  variables?: Record<string, string>;
  /** 첨부파일 목록 */
  attachments?: string[];
  /** 참조/회신 문서번호 */
  referenceDocNumber?: string;
}

/** 생성된 문서 */
export interface GeneratedDocument {
  /** 문서 ID */
  documentId: string;
  /** 양식 유형 */
  type: OfficialDocumentType;
  /** 문서번호 */
  documentNumber: string;
  /** 제목 */
  title: string;
  /** 생성된 전문 (마크다운) */
  content: string;
  /** 생성 시각 */
  createdAt: string;
  /** 사용된 토큰 수 */
  tokensUsed: number;
  /** 검증 결과 */
  validation: DocumentValidation;
  /** 버전 */
  version: number;
}

/** 문서 검증 결과 — FR-ADV13.5 */
export interface DocumentValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/** 문서 이력 항목 — FR-ADV13.6 */
export interface DocumentRevision {
  version: number;
  content: string;
  modifiedAt: string;
  modifiedBy: string;
  reason: string;
}

// ── 양식 템플릿 — FR-ADV13.1, Design §1 ─────────────────────────────────────

const TEMPLATES: Record<OfficialDocumentType, string> = {
  cooperation: `# {{title}}

**문서번호**: {{documentNumber}}
**발신**: {{senderOrg}}
**수신**: {{recipientOrg}}
**시행일자**: {{date}}
{{#referenceDocNumber}}
**관련**: {{referenceDocNumber}}
{{/referenceDocNumber}}

---

## 본문

{{body}}

---

{{#attachments}}
## 첨부

{{attachmentList}}
{{/attachments}}

**{{senderOrg}}장**`,

  report: `# {{title}}

**문서번호**: {{documentNumber}}
**보고자**: {{senderOrg}}
**보고 대상**: {{recipientOrg}}
**보고일**: {{date}}

---

## 1. 개요

{{body}}

---

{{#attachments}}
## 첨부 자료

{{attachmentList}}
{{/attachments}}`,

  minutes: `# {{title}}

**회의일시**: {{date}}
**회의장소**: {{location}}
**참석자**: {{attendees}}
**작성자**: {{senderOrg}}

---

## 회의 내용

{{body}}

---

## 결정 사항

{{decisions}}

## 향후 조치 사항

{{actions}}`,

  draft: `# {{title}}

**문서번호**: {{documentNumber}}
**기안자**: {{senderOrg}}
**기안일**: {{date}}
**수신**: {{recipientOrg}}

---

## 제안 사유

{{body}}

---

## 세부 내용

{{details}}

{{#attachments}}
## 첨부

{{attachmentList}}
{{/attachments}}

---

**결재선**: 기안자 → 검토자 → 결재권자`,

  notice: `# {{title}}

**공고번호**: {{documentNumber}}
**공고기관**: {{senderOrg}}
**공고일**: {{date}}

---

{{body}}

---

**문의처**: {{senderOrg}}
**공고기간**: {{noticePeriod}}`,
};

// ── 필수 필드 정의 ──────────────────────────────────────────────────────────

const REQUIRED_FIELDS: Record<OfficialDocumentType, string[]> = {
  cooperation: ['senderOrg', 'recipientOrg', 'title', 'body'],
  report: ['senderOrg', 'recipientOrg', 'title', 'body'],
  minutes: ['senderOrg', 'title', 'body'],
  draft: ['senderOrg', 'recipientOrg', 'title', 'body'],
  notice: ['senderOrg', 'title', 'body'],
};

// ── 공문서 생성기 ────────────────────────────────────────────────────────────

/**
 * 공문서 자동 생성기
 *
 * AI가 공공기관 표준 양식에 맞는 공문서 초안을 자동 생성합니다.
 * 양식 구조는 템플릿 엔진이 보장하고, 본문 내용은 LLM이 생성합니다.
 */
export class DocumentGenerator {
  private readonly provider: LLMProvider;
  private readonly revisions: Map<string, DocumentRevision[]> = new Map();
  private docCounter = 0;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  /**
   * 공문서를 자동 생성합니다
   */
  async generate(input: DocumentGenerationInput): Promise<GeneratedDocument> {
    const documentId = crypto.randomUUID();
    const documentNumber = this.generateDocNumber(input.type);
    const date = new Date().toLocaleDateString('ko-KR');

    // 1. AI 본문 생성 — FR-ADV13.2
    const body = await this.generateBody(input);

    // 2. 양식 변수 구성
    const variables: Record<string, string> = {
      title: input.title,
      documentNumber,
      senderOrg: input.senderOrg,
      recipientOrg: input.recipientOrg,
      date,
      body,
      referenceDocNumber: input.referenceDocNumber ?? '',
      attachmentList: (input.attachments ?? []).map((a, i) => `${i + 1}. ${a}`).join('\n'),
      ...input.variables,
    };

    // 3. 템플릿 렌더링 — FR-ADV13.1
    const template = TEMPLATES[input.type];
    const content = this.renderTemplate(template, variables, input);

    // 4. PII 마스킹
    const maskedContent = maskPII(content);

    // 5. 검증 — FR-ADV13.5
    const validation = this.validateDocument(input.type, variables);

    // 6. 이력 기록 — FR-ADV13.6
    const revision: DocumentRevision = {
      version: 1,
      content: maskedContent,
      modifiedAt: new Date().toISOString(),
      modifiedBy: 'ai-generator',
      reason: '초안 자동 생성',
    };
    this.revisions.set(documentId, [revision]);

    return {
      documentId,
      type: input.type,
      documentNumber,
      title: input.title,
      content: maskedContent,
      createdAt: new Date().toISOString(),
      tokensUsed: 0, // LLM 호출에서 갱신
      validation,
      version: 1,
    };
  }

  /**
   * 문서 이력을 조회합니다 — FR-ADV13.6
   */
  getRevisions(documentId: string): DocumentRevision[] {
    return this.revisions.get(documentId) ?? [];
  }

  // ── AI 본문 생성 — FR-ADV13.2, Design §2 ─────────────────────────

  private async generateBody(input: DocumentGenerationInput): Promise<string> {
    const typeLabel = DOC_TYPE_LABELS[input.type];
    const referencesText = input.references?.length
      ? `\n\n참조 자료:\n${input.references.map((r, i) => `${i + 1}. ${r}`).join('\n')}`
      : '';

    const messages: LLMMessage[] = [
      {
        role: 'system',
        content: `당신은 공공기관 공문서 작성 전문가입니다.
다음 규칙을 준수하십시오:
1. 공공기관 표준 문체(~합니다/~됩니다) 사용
2. 간결하고 명확한 표현
3. 불필요한 수식어 자제
4. 구체적인 사실과 근거 중심
5. 개인정보는 절대 포함하지 마십시오`,
      },
      {
        role: 'user',
        content: `다음 ${typeLabel}의 본문을 작성하십시오.

제목: ${input.title}
발신: ${input.senderOrg}
수신: ${input.recipientOrg}

작성 지시사항:
${input.instruction}${referencesText}

본문만 작성하십시오 (양식 서두/서명 제외).`,
      },
    ];

    const response = await this.provider.chat(messages, {
      maxTokens: 2048,
      temperature: 0.3,
    });

    return maskPII(response.text);
  }

  // ── 템플릿 렌더링 — FR-ADV13.1, Design §1 ────────────────────────

  private renderTemplate(
    template: string,
    variables: Record<string, string>,
    input: DocumentGenerationInput,
  ): string {
    let result = template;

    // 변수 치환
    for (const [key, value] of Object.entries(variables)) {
      result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
    }

    // 조건부 섹션 처리
    // {{#attachments}}...{{/attachments}}
    if (input.attachments && input.attachments.length > 0) {
      result = result.replace(/\{\{#attachments\}\}([\s\S]*?)\{\{\/attachments\}\}/g, '$1');
    } else {
      result = result.replace(/\{\{#attachments\}\}[\s\S]*?\{\{\/attachments\}\}/g, '');
    }

    // {{#referenceDocNumber}}...{{/referenceDocNumber}}
    if (input.referenceDocNumber) {
      result = result.replace(/\{\{#referenceDocNumber\}\}([\s\S]*?)\{\{\/referenceDocNumber\}\}/g, '$1');
    } else {
      result = result.replace(/\{\{#referenceDocNumber\}\}[\s\S]*?\{\{\/referenceDocNumber\}\}/g, '');
    }

    // 미치환 변수 제거
    result = result.replace(/\{\{[^}]+\}\}/g, '');

    return result.trim();
  }

  // ── 문서 검증 — FR-ADV13.5, Design §3 ────────────────────────────

  private validateDocument(
    type: OfficialDocumentType,
    variables: Record<string, string>,
  ): DocumentValidation {
    const errors: string[] = [];
    const warnings: string[] = [];

    // 필수 필드 확인
    const requiredFields = REQUIRED_FIELDS[type] ?? [];
    for (const field of requiredFields) {
      if (!variables[field] || variables[field].trim().length === 0) {
        errors.push(`필수 필드 누락: ${field}`);
      }
    }

    // 문서번호 형식 검증
    const docNum = variables['documentNumber'] ?? '';
    if (docNum && !/^[A-Z]+-\d{4}-\d+$/.test(docNum)) {
      warnings.push(`문서번호 형식 확인 필요: ${docNum} (권장: ABC-YYYY-NNN)`);
    }

    // 본문 길이 확인
    const body = variables['body'] ?? '';
    if (body.length < 50) {
      warnings.push('본문이 너무 짧습니다 (50자 미만)');
    }
    if (body.length > 10000) {
      warnings.push('본문이 매우 깁니다 (10,000자 초과)');
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  // ── 문서번호 생성 — FR-ADV13.3 ────────────────────────────────────

  private generateDocNumber(type: OfficialDocumentType): string {
    this.docCounter++;
    const prefix: Record<OfficialDocumentType, string> = {
      cooperation: 'COO',
      report: 'RPT',
      minutes: 'MIN',
      draft: 'DRF',
      notice: 'NTC',
    };
    const year = new Date().getFullYear();
    return `${prefix[type]}-${year}-${String(this.docCounter).padStart(4, '0')}`;
  }
}

// ── 팩토리 ───────────────────────────────────────────────────────────────────

export function createDocumentGenerator(provider: LLMProvider): DocumentGenerator {
  return new DocumentGenerator(provider);
}
