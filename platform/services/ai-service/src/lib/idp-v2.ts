// Design Ref: MTU-N476 §IDP v2 지능형 문서 처리
// Plan SC: FR-IDP.1~5

export interface OcrBlock {
  text: string;
  bbox: { x: number; y: number; w: number; h: number };
  confidence: number;
}

export interface ExtractedField {
  name: string;
  value: string;
  confidence: number;
  valid: boolean;
}

export interface ValidationRule {
  field: string;
  type: 'date' | 'amount' | 'korean-biz-no' | 'regex';
  pattern?: RegExp;
}

export interface ReviewItem {
  documentId: string;
  reason: string;
  fields: ExtractedField[];
}

export class IdpV2 {
  private rules = new Map<string, ValidationRule>();
  private reviewQueue: ReviewItem[] = [];

  /** FR-IDP.1 OCR 결과 구조화 */
  structure(blocks: OcrBlock[]): string {
    return blocks
      .sort((a, b) => a.bbox.y - b.bbox.y || a.bbox.x - b.bbox.x)
      .map((b) => b.text)
      .join(' ');
  }

  registerRule(rule: ValidationRule): void {
    this.rules.set(rule.field, rule);
  }

  /** FR-IDP.2 필드 추출 (단순 룰) */
  extractFields(text: string): ExtractedField[] {
    const out: ExtractedField[] = [];
    const amountMatch = text.match(/([\d,]+)\s*원/);
    if (amountMatch && amountMatch[1])
      out.push({
        name: 'amount',
        value: amountMatch[1].replace(/,/g, ''),
        confidence: 0.9,
        valid: true,
      });
    const dateMatch = text.match(/(\d{4}[-./]\d{1,2}[-./]\d{1,2})/);
    if (dateMatch && dateMatch[1])
      out.push({ name: 'date', value: dateMatch[1], confidence: 0.95, valid: true });
    const bizMatch = text.match(/(\d{3}-\d{2}-\d{5})/);
    if (bizMatch && bizMatch[1])
      out.push({ name: 'biz_no', value: bizMatch[1], confidence: 0.88, valid: true });
    return out.map((f) => this.validate(f));
  }

  /** FR-IDP.3 검증 규칙 적용 */
  private validate(field: ExtractedField): ExtractedField {
    const rule = this.rules.get(field.name);
    if (!rule) return field;
    let valid = true;
    if (rule.type === 'amount') valid = /^\d+$/.test(field.value);
    if (rule.type === 'date') valid = /^\d{4}/.test(field.value);
    if (rule.type === 'korean-biz-no') valid = /^\d{3}-\d{2}-\d{5}$/.test(field.value);
    if (rule.type === 'regex' && rule.pattern) valid = rule.pattern.test(field.value);
    return { ...field, valid };
  }

  /** FR-IDP.4 신뢰도 점수 집계 */
  documentConfidence(fields: ExtractedField[]): number {
    if (fields.length === 0) return 0;
    return +(fields.reduce((s, f) => s + f.confidence, 0) / fields.length).toFixed(3);
  }

  /** FR-IDP.5 수동 검토 대기열 */
  queueForReview(documentId: string, fields: ExtractedField[]): ReviewItem | undefined {
    const conf = this.documentConfidence(fields);
    const hasInvalid = fields.some((f) => !f.valid);
    if (conf < 0.85 || hasInvalid) {
      const item: ReviewItem = {
        documentId,
        reason: hasInvalid ? '검증 실패' : `신뢰도 낮음 ${conf}`,
        fields,
      };
      this.reviewQueue.push(item);
      return item;
    }
    return undefined;
  }

  getReviewQueue(): ReviewItem[] {
    return [...this.reviewQueue];
  }
}

export const idpV2 = new IdpV2();
