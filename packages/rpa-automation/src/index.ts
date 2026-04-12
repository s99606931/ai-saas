/**
 * RPA + IDP + Email Triage + 회의 최적화 파사드
 * MTU-N475~N478
 */

// ============ MTU-N475: RPA 봇 빌더 ============

export interface RpaStep {
  stepId: string;
  action: 'click' | 'type' | 'read' | 'wait' | 'api-call' | 'condition';
  parameters: Record<string, unknown>;
  nextOnSuccess?: string;
  nextOnFailure?: string;
}

export interface RpaProcess {
  processId: string;
  name: string;
  steps: RpaStep[];
  entryStep: string;
}

export class RpaProcessBuilder {
  private process: RpaProcess;

  constructor(processId: string, name: string, entryStep: string) {
    this.process = {
      processId,
      name,
      steps: [],
      entryStep,
    };
  }

  addStep(step: RpaStep): this {
    this.process.steps.push({ ...step });
    return this;
  }

  build(): RpaProcess {
    const stepIds = new Set(this.process.steps.map((s) => s.stepId));
    if (!stepIds.has(this.process.entryStep)) {
      throw new Error(`entryStep이 steps에 없음: ${this.process.entryStep}`);
    }
    return { ...this.process, steps: this.process.steps.map((s) => ({ ...s })) };
  }
}

export interface RpaExecution {
  executionId: string;
  processId: string;
  status: 'running' | 'completed' | 'failed';
  currentStep: string | null;
  startedAt: string;
  endedAt: string | null;
  errors: string[];
}

export class RpaAuditLog {
  private entries: Array<{ executionId: string; stepId: string; result: string; timestamp: string }> = [];

  log(executionId: string, stepId: string, result: string): void {
    this.entries.push({
      executionId,
      stepId,
      result,
      timestamp: new Date().toISOString(),
    });
  }

  history(executionId: string): typeof this.entries {
    return this.entries.filter((e) => e.executionId === executionId).map((e) => ({ ...e }));
  }
}

// ============ MTU-N476: IDP v2 ============

export interface DocumentField {
  fieldName: string;
  value: string;
  confidence: number;
  page: number;
}

export interface ExtractedDocument {
  documentId: string;
  type: string;
  fields: DocumentField[];
  overallConfidence: number;
  needsReview: boolean;
}

export class IdpExtractor {
  /**
   * 추출 결과에서 검증 + 신뢰도 계산
   */
  process(
    documentId: string,
    type: string,
    rawFields: DocumentField[],
    requiredFields: string[],
  ): ExtractedDocument {
    const fieldMap = new Map(rawFields.map((f) => [f.fieldName, f]));
    const missing = requiredFields.filter((f) => !fieldMap.has(f));
    const validFields = rawFields.filter((f) => f.confidence > 0.6);
    const overallConfidence =
      validFields.length > 0
        ? validFields.reduce((s, f) => s + f.confidence, 0) / validFields.length
        : 0;
    const needsReview = overallConfidence < 0.85 || missing.length > 0;

    return {
      documentId,
      type,
      fields: rawFields.map((f) => ({ ...f })),
      overallConfidence,
      needsReview,
    };
  }
}

export class ReviewQueue {
  private items: ExtractedDocument[] = [];

  enqueue(doc: ExtractedDocument): void {
    if (doc.needsReview) {
      this.items.push({ ...doc });
    }
  }

  pending(): ExtractedDocument[] {
    return this.items.map((i) => ({ ...i }));
  }
}

// ============ MTU-N477: Email Triage ============

export type EmailCategory = 'complaint' | 'inquiry' | 'promotion' | 'spam' | 'other';

export interface EmailClassification {
  messageId: string;
  category: EmailCategory;
  priority: number; // 0-10
  confidence: number;
  suggestedTemplate?: string;
}

export class EmailClassifier {
  classify(email: { subject: string; body: string; sender: string }): EmailClassification {
    const text = `${email.subject} ${email.body}`.toLowerCase();
    let category: EmailCategory = 'other';
    let priority = 5;

    if (/민원|불만|항의|complaint/.test(text)) {
      category = 'complaint';
      priority = 9;
    } else if (/문의|질문|inquiry/.test(text)) {
      category = 'inquiry';
      priority = 7;
    } else if (/할인|광고|promotion|sale/.test(text)) {
      category = 'promotion';
      priority = 2;
    } else if (/당첨|상금|lottery|prize/.test(text)) {
      category = 'spam';
      priority = 1;
    }

    return {
      messageId: `msg-${Date.now()}`,
      category,
      priority,
      confidence: 0.85,
      suggestedTemplate: category === 'complaint' ? 'complaint-response-v1' : undefined,
    };
  }
}

// ============ MTU-N478: 회의 일정 최적화 ============

export interface ParticipantAvailability {
  participantId: string;
  priority: number; // 가중치
  availableSlots: Array<{ start: string; end: string }>;
}

export class MeetingOptimizer {
  findBestSlot(
    participants: ParticipantAvailability[],
    durationMinutes: number,
  ): { start: string; end: string; score: number } | null {
    if (participants.length === 0) return null;

    // 모든 가능한 슬롯을 수집하고 겹치는 시간대 탐색
    const candidates = new Map<string, number>();
    for (const p of participants) {
      for (const slot of p.availableSlots) {
        const key = `${slot.start}|${slot.end}`;
        candidates.set(key, (candidates.get(key) ?? 0) + p.priority);
      }
    }

    let best: { start: string; end: string; score: number } | null = null;
    for (const [key, score] of candidates) {
      const parts = key.split('|');
      const start = parts[0] ?? '';
      const end = parts[1] ?? '';
      if (!start || !end) continue;
      const duration = (new Date(end).getTime() - new Date(start).getTime()) / 60000;
      if (duration < durationMinutes) continue;
      if (!best || score > best.score) {
        best = { start, end, score };
      }
    }
    return best;
  }
}
