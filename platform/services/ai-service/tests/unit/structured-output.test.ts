// SVC-AI-2026 단위 테스트: Structured Outputs
// Design Ref: SVC-AI-2026 DESIGN §3
// Plan SC: FR-AI26.3

import { describe, it, expect, vi } from 'vitest';

// PII 마스킹 모의
vi.mock('../../src/lib/pii-masking.js', () => ({
  maskPII: vi.fn((text: string) => text.replace(/\d{6}-\d{7}/g, '***-***')),
}));

import {
  buildStructuredMessages,
  parseStructuredOutput,
} from '../../src/lib/structured-output.js';
import type { OutputSchema } from '../../src/lib/structured-output.js';

// ── buildStructuredMessages 테스트 ──────────────────────────────────────────

describe('buildStructuredMessages 메시지 구성', () => {
  it('citizen_request 스키마 메시지를 구성한다', () => {
    const messages = buildStructuredMessages('citizen_request', '도로 포트홀 신고합니다.');
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe('system');
    expect(messages[0]?.content).toContain('JSON');
    expect(messages[1]?.role).toBe('user');
    expect(messages[1]?.content).toContain('민원');
    expect(messages[1]?.content).toContain('도로 포트홀');
  });

  it('document_analysis 스키마 메시지를 구성한다', () => {
    const messages = buildStructuredMessages('document_analysis', '보고서 내용입니다.');
    expect(messages[1]?.content).toContain('문서');
  });

  it('meeting_summary 스키마 메시지를 구성한다', () => {
    const messages = buildStructuredMessages('meeting_summary', '회의 내용입니다.');
    expect(messages[1]?.content).toContain('회의록');
  });

  it('risk_assessment 스키마 메시지를 구성한다', () => {
    const messages = buildStructuredMessages('risk_assessment', '위험 요소 분석 대상입니다.');
    expect(messages[1]?.content).toContain('위험도');
  });

  it('PII가 마스킹된다', () => {
    const messages = buildStructuredMessages('citizen_request', '주민번호 900101-1234567 입니다.');
    expect(messages[1]?.content).not.toContain('900101-1234567');
    expect(messages[1]?.content).toContain('***-***');
  });

  it('system 메시지에 JSON 전용 지시를 포함한다', () => {
    const messages = buildStructuredMessages('citizen_request', '테스트');
    expect(messages[0]?.content).toContain('JSON만 출력');
  });
});

// ── parseStructuredOutput 테스트 ────────────────────────────────────────────

describe('parseStructuredOutput JSON 파싱', () => {
  it('유효한 JSON을 파싱한다', () => {
    const json = JSON.stringify({
      category: '교통',
      subCategory: '도로 보수',
      priority: '높음',
      department: '건설과',
      summary: '포트홀 신고',
      keywords: ['포트홀', '도로'],
      requiresHuman: false,
      estimatedDays: 3,
      sentiment: '부정',
    });

    const result = parseStructuredOutput('citizen_request', json);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('교통');
      expect(result.data.priority).toBe('높음');
    }
  });

  it('마크다운 코드블록 내 JSON을 추출한다', () => {
    const response = '분석 결과:\n```json\n{"category":"복지","subCategory":"연금","priority":"보통","department":"복지과","summary":"연금 문의","keywords":["연금"],"requiresHuman":false,"estimatedDays":5,"sentiment":"중립"}\n```';
    const result = parseStructuredOutput('citizen_request', response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.category).toBe('복지');
    }
  });

  it('코드블록 없는 JSON도 추출한다', () => {
    const response = '다음은 분석 결과입니다. {"overallRisk":"낮음","riskFactors":[],"recommendation":"위험 없음","urgency":false}';
    const result = parseStructuredOutput('risk_assessment', response);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.overallRisk).toBe('낮음');
    }
  });

  it('유효하지 않은 JSON은 실패를 반환한다', () => {
    const result = parseStructuredOutput('citizen_request', '이것은 JSON이 아닙니다');
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toContain('JSON 파싱 실패');
      expect(result.raw).toBeDefined();
    }
  });

  it('빈 문자열은 실패를 반환한다', () => {
    const result = parseStructuredOutput('document_analysis', '');
    expect(result.success).toBe(false);
  });

  it('document_analysis 스키마를 파싱한다', () => {
    const json = JSON.stringify({
      title: '보안 검토 보고서',
      summary: '보안 점검 결과 요약',
      keyPoints: ['취약점 3건 발견', '패치 필요'],
      riskLevel: '높음',
      riskItems: ['SQL 주입 취약점'],
      actionRequired: true,
      deadline: '2026-04-30',
      documentType: '보고서',
    });
    const result = parseStructuredOutput('document_analysis', json);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskLevel).toBe('높음');
      expect(result.data.actionRequired).toBe(true);
    }
  });

  it('meeting_summary 스키마를 파싱한다', () => {
    const json = JSON.stringify({
      title: '보안 회의',
      date: '2026-04-11',
      participants: ['홍길동', '김철수'],
      decisions: ['보안 패치 적용'],
      actionItems: [{ task: '패치 적용', assignee: '홍길동', dueDate: '2026-04-15' }],
      nextMeetingDate: '2026-04-18',
    });
    const result = parseStructuredOutput('meeting_summary', json);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.participants).toHaveLength(2);
      expect(result.data.actionItems).toHaveLength(1);
    }
  });
});
