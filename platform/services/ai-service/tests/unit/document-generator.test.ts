// SVC-AI-ADV-R13 단위 테스트: 공문서 자동 생성기
// Design Ref: SVC-AI-ADV-R13 DESIGN §1~§3
// Plan SC: FR-ADV13.1~FR-ADV13.6
// CSAP: D-12 시스템 개발 보안, D-08 접근 통제

import { describe, it, expect, vi, beforeEach } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  DocumentGenerator,
  createDocumentGenerator,
} from '../../src/lib/document-generator.js';
import type {
  OfficialDocumentType,
  DocumentGenerationInput,
  GeneratedDocument,
} from '../../src/lib/document-generator.js';

// ── 모의 LLM 프로바이더 ────────────────────────────────────────────────────

function createMockProvider(bodyText: string = '본 건에 대해 검토한 결과를 보고합니다. 세부 사항은 아래와 같습니다.') {
  return {
    chat: vi.fn().mockResolvedValue({
      text: bodyText,
      tokensUsed: 150,
      model: 'test-model',
    }),
  };
}

function createDefaultInput(overrides: Partial<DocumentGenerationInput> = {}): DocumentGenerationInput {
  return {
    type: 'cooperation',
    senderOrg: '행정안전부',
    recipientOrg: '과학기술정보통신부',
    title: '정보보호 협력 요청',
    instruction: '사이버 보안 관련 협력 요청 본문을 작성하십시오.',
    ...overrides,
  };
}

// ── 문서 생성 기본 테스트 ───────────────────────────────────────────────────

describe('DocumentGenerator 문서 생성 (FR-ADV13.1~13.2)', () => {
  let generator: DocumentGenerator;
  let mockProvider: ReturnType<typeof createMockProvider>;

  beforeEach(() => {
    mockProvider = createMockProvider();
    generator = new DocumentGenerator(mockProvider as never);
  });

  it('협조전을 생성한다', async () => {
    const doc = await generator.generate(createDefaultInput({ type: 'cooperation' }));
    expect(doc.type).toBe('cooperation');
    expect(doc.title).toBe('정보보호 협력 요청');
    expect(doc.content).toContain('행정안전부');
    expect(doc.content).toContain('과학기술정보통신부');
    expect(doc.documentNumber).toMatch(/^COO-\d{4}-\d{4}$/);
  });

  it('보고서를 생성한다', async () => {
    const doc = await generator.generate(createDefaultInput({ type: 'report' }));
    expect(doc.type).toBe('report');
    expect(doc.documentNumber).toMatch(/^RPT-\d{4}-\d{4}$/);
    expect(doc.content).toContain('개요');
  });

  it('회의록을 생성한다', async () => {
    const doc = await generator.generate(createDefaultInput({ type: 'minutes' }));
    expect(doc.type).toBe('minutes');
    expect(doc.documentNumber).toMatch(/^MIN-\d{4}-\d{4}$/);
    expect(doc.content).toContain('회의 내용');
  });

  it('기안문을 생성한다', async () => {
    const doc = await generator.generate(createDefaultInput({ type: 'draft' }));
    expect(doc.type).toBe('draft');
    expect(doc.documentNumber).toMatch(/^DRF-\d{4}-\d{4}$/);
    expect(doc.content).toContain('제안 사유');
    expect(doc.content).toContain('결재선');
  });

  it('공고문을 생성한다', async () => {
    const doc = await generator.generate(createDefaultInput({ type: 'notice' }));
    expect(doc.type).toBe('notice');
    expect(doc.documentNumber).toMatch(/^NTC-\d{4}-\d{4}$/);
    expect(doc.content).toContain('공고기관');
  });

  it('문서 ID가 UUID 형식이다', async () => {
    const doc = await generator.generate(createDefaultInput());
    expect(doc.documentId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
    );
  });

  it('createdAt이 ISO 문자열이다', async () => {
    const doc = await generator.generate(createDefaultInput());
    expect(() => new Date(doc.createdAt)).not.toThrow();
    expect(new Date(doc.createdAt).toISOString()).toBe(doc.createdAt);
  });

  it('문서번호가 순차 증가한다', async () => {
    const doc1 = await generator.generate(createDefaultInput({ type: 'cooperation' }));
    const doc2 = await generator.generate(createDefaultInput({ type: 'cooperation' }));
    const num1 = parseInt(doc1.documentNumber.split('-')[2] ?? '0', 10);
    const num2 = parseInt(doc2.documentNumber.split('-')[2] ?? '0', 10);
    expect(num2).toBe(num1 + 1);
  });
});

// ── 템플릿 렌더링 — FR-ADV13.1 ─────────────────────────────────────────────

describe('DocumentGenerator 템플릿 렌더링 (FR-ADV13.1)', () => {
  let generator: DocumentGenerator;

  beforeEach(() => {
    generator = new DocumentGenerator(createMockProvider() as never);
  });

  it('첨부파일이 있으면 첨부 섹션을 포함한다', async () => {
    const doc = await generator.generate(
      createDefaultInput({
        attachments: ['첨부1.pdf', '첨부2.xlsx'],
      }),
    );
    expect(doc.content).toContain('첨부');
    expect(doc.content).toContain('첨부1.pdf');
    expect(doc.content).toContain('첨부2.xlsx');
  });

  it('첨부파일이 없으면 첨부 섹션을 제거한다', async () => {
    const doc = await generator.generate(
      createDefaultInput({ attachments: undefined }),
    );
    expect(doc.content).not.toContain('{{#attachments}}');
    expect(doc.content).not.toContain('{{/attachments}}');
  });

  it('참조 문서번호가 있으면 관련 섹션을 포함한다', async () => {
    const doc = await generator.generate(
      createDefaultInput({ referenceDocNumber: 'COO-2026-0001' }),
    );
    expect(doc.content).toContain('COO-2026-0001');
  });

  it('참조 문서번호가 없으면 관련 섹션을 제거한다', async () => {
    const doc = await generator.generate(
      createDefaultInput({ referenceDocNumber: undefined }),
    );
    expect(doc.content).not.toContain('{{#referenceDocNumber}}');
  });

  it('미치환 변수를 제거한다', async () => {
    const doc = await generator.generate(createDefaultInput({ type: 'minutes' }));
    // 회의록은 location, attendees 등 variables에 없는 변수가 있음
    expect(doc.content).not.toContain('{{');
    expect(doc.content).not.toContain('}}');
  });

  it('추가 변수를 적용한다', async () => {
    const doc = await generator.generate(
      createDefaultInput({
        type: 'minutes',
        variables: {
          location: '정부서울청사 3층 대회의실',
          attendees: '홍길동, 김철수, 이영희',
        },
      }),
    );
    expect(doc.content).toContain('정부서울청사 3층 대회의실');
    expect(doc.content).toContain('홍길동, 김철수, 이영희');
  });
});

// ── AI 본문 생성 — FR-ADV13.2 ──────────────────────────────────────────────

describe('DocumentGenerator AI 본문 생성 (FR-ADV13.2)', () => {
  it('LLM 프로바이더를 호출하여 본문을 생성한다', async () => {
    const mockProvider = createMockProvider('검토 결과를 보고합니다.');
    const generator = new DocumentGenerator(mockProvider as never);

    await generator.generate(createDefaultInput());

    expect(mockProvider.chat).toHaveBeenCalledOnce();
    const messages = mockProvider.chat.mock.calls[0]?.[0];
    expect(messages).toHaveLength(2);
    expect(messages[0].role).toBe('system');
    expect(messages[1].role).toBe('user');
  });

  it('시스템 프롬프트에 공문서 작성 규칙을 포함한다', async () => {
    const mockProvider = createMockProvider();
    const generator = new DocumentGenerator(mockProvider as never);

    await generator.generate(createDefaultInput());

    const systemMsg = mockProvider.chat.mock.calls[0]?.[0]?.[0]?.content;
    expect(systemMsg).toContain('공공기관');
    expect(systemMsg).toContain('개인정보');
  });

  it('참조 자료를 프롬프트에 포함한다', async () => {
    const mockProvider = createMockProvider();
    const generator = new DocumentGenerator(mockProvider as never);

    await generator.generate(
      createDefaultInput({
        references: ['개인정보보호법 제15조', '행정절차법 제20조'],
      }),
    );

    const userMsg = mockProvider.chat.mock.calls[0]?.[0]?.[1]?.content;
    expect(userMsg).toContain('참조 자료');
    expect(userMsg).toContain('개인정보보호법 제15조');
  });
});

// ── 문서 검증 — FR-ADV13.5 ─────────────────────────────────────────────────

describe('DocumentGenerator 문서 검증 (FR-ADV13.5)', () => {
  let generator: DocumentGenerator;

  beforeEach(() => {
    generator = new DocumentGenerator(createMockProvider() as never);
  });

  it('유효한 문서는 isValid=true이다', async () => {
    const doc = await generator.generate(createDefaultInput());
    expect(doc.validation.isValid).toBe(true);
    expect(doc.validation.errors).toHaveLength(0);
  });

  it('본문이 짧으면 경고를 반환한다', async () => {
    const mockProvider = createMockProvider('짧음');
    const gen = new DocumentGenerator(mockProvider as never);
    const doc = await gen.generate(createDefaultInput());
    expect(doc.validation.warnings.some((w) => w.includes('짧습니다'))).toBe(true);
  });

  it('version이 1부터 시작한다', async () => {
    const doc = await generator.generate(createDefaultInput());
    expect(doc.version).toBe(1);
  });
});

// ── 이력 관리 — FR-ADV13.6 ─────────────────────────────────────────────────

describe('DocumentGenerator 이력 관리 (FR-ADV13.6)', () => {
  let generator: DocumentGenerator;

  beforeEach(() => {
    generator = new DocumentGenerator(createMockProvider() as never);
  });

  it('생성 시 이력을 기록한다', async () => {
    const doc = await generator.generate(createDefaultInput());
    const revisions = generator.getRevisions(doc.documentId);
    expect(revisions).toHaveLength(1);
    expect(revisions[0]?.version).toBe(1);
    expect(revisions[0]?.reason).toContain('초안');
  });

  it('존재하지 않는 문서 ID는 빈 배열을 반환한다', () => {
    const revisions = generator.getRevisions('nonexistent-id');
    expect(revisions).toHaveLength(0);
  });

  it('이력에 타임스탬프가 포함된다', async () => {
    const doc = await generator.generate(createDefaultInput());
    const revisions = generator.getRevisions(doc.documentId);
    expect(revisions[0]?.modifiedAt).toBeDefined();
    expect(() => new Date(revisions[0]?.modifiedAt ?? '')).not.toThrow();
  });
});

// ── 팩토리 함수 ─────────────────────────────────────────────────────────────

describe('createDocumentGenerator 팩토리', () => {
  it('DocumentGenerator 인스턴스를 생성한다', () => {
    const provider = createMockProvider();
    const generator = createDocumentGenerator(provider as never);
    expect(generator).toBeInstanceOf(DocumentGenerator);
  });
});
