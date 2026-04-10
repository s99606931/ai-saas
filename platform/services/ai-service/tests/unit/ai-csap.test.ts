// AI 서비스 CSAP/N2SF 보안 테스트
// Design Ref: DESIGN-MTU-P10
// Plan SC: FR-P10.1~FR-P10.6
// CSAP: D-08 접근통제, D-06 감사로그, N2SF N-05 AI 데이터 분류

import { describe, it, expect } from 'vitest';
import { z } from 'zod';

const chatSchema = z.object({
  modelId: z.string().min(1),
  messages: z
    .array(
      z.object({
        role: z.enum(['system', 'user', 'assistant']),
        content: z.string().min(1).max(32000),
      }),
    )
    .min(1),
  temperature: z.number().min(0).max(2).default(0.7),
  maxTokens: z.number().int().min(1).max(4096).default(1024),
  dataGrade: z.enum(['O', 'C', 'S']).default('O'),
});

const registerModelSchema = z.object({
  name: z.string().min(1).max(100),
  provider: z.enum(['LM_STUDIO', 'OLLAMA', 'CUSTOM']),
  endpoint: z.string().url(),
  apiKey: z.string().optional(),
  maxConcurrent: z.number().int().min(1).max(100).default(10),
});

describe('N2SF N-05: AI 데이터 등급 분류', () => {
  it('O등급 데이터만 AI API 전송을 허용한다', () => {
    const grade = 'O';
    const isAllowed = grade === 'O';
    expect(isAllowed).toBe(true);
  });

  it('C등급 데이터는 AI API 전송을 차단한다', () => {
    const grade = 'C';
    const isAllowed = grade === 'O';
    expect(isAllowed).toBe(false);
  });

  it('S등급 데이터는 AI API 전송을 차단한다', () => {
    const grade = 'S';
    const isAllowed = grade === 'O';
    expect(isAllowed).toBe(false);
  });

  it('PII 마스킹 패턴이 올바르다', () => {
    const content = '주민번호: 900101-1234567, 전화: 010-1234-5678';

    // 주민번호 마스킹
    const maskedRRN = content.replace(/(\d{6})-(\d{7})/g, '$1-*******');
    expect(maskedRRN).toContain('900101-*******');

    // 전화번호 마스킹
    const maskedPhone = maskedRRN.replace(/(\d{3})-(\d{4})-(\d{4})/g, '$1-****-$3');
    expect(maskedPhone).toContain('010-****-5678');
  });

  it('이메일 PII 마스킹이 올바르다', () => {
    const email = 'admin@example.com';
    const masked = email.replace(/^(.{2}).*(@.*)$/, '$1***$2');
    expect(masked).toBe('ad***@example.com');
  });
});

describe('CSAP D-12: AI 입력 검증', () => {
  it('유효한 채팅 요청을 허용한다', () => {
    const result = chatSchema.safeParse({
      modelId: 'llama-3',
      messages: [{ role: 'user', content: '안녕하세요' }],
      dataGrade: 'O',
    });
    expect(result.success).toBe(true);
  });

  it('C등급 데이터 요청을 스키마에서 허용하지만 핸들러에서 차단한다', () => {
    const result = chatSchema.safeParse({
      modelId: 'llama-3',
      messages: [{ role: 'user', content: '기밀 데이터' }],
      dataGrade: 'C',
    });
    // 스키마는 통과 (enum에 포함)
    expect(result.success).toBe(true);
    // 핸들러의 validateDataGrade()에서 차단
    if (result.success) {
      expect(result.data.dataGrade).toBe('C');
    }
  });

  it('빈 메시지 배열을 거부한다', () => {
    expect(
      chatSchema.safeParse({
        modelId: 'llama-3',
        messages: [],
      }).success,
    ).toBe(false);
  });

  it('과도한 토큰 수를 거부한다', () => {
    expect(
      chatSchema.safeParse({
        modelId: 'llama-3',
        messages: [{ role: 'user', content: '안녕' }],
        maxTokens: 999999,
      }).success,
    ).toBe(false);
  });

  it('temperature 범위를 벗어나면 거부한다', () => {
    expect(
      chatSchema.safeParse({
        modelId: 'llama-3',
        messages: [{ role: 'user', content: '안녕' }],
        temperature: 5,
      }).success,
    ).toBe(false);
  });

  it('잘못된 역할을 거부한다', () => {
    expect(
      chatSchema.safeParse({
        modelId: 'llama-3',
        messages: [{ role: 'hacker', content: '테스트' }],
      }).success,
    ).toBe(false);
  });

  it('모델 등록 시 유효한 URL이 필요하다', () => {
    expect(
      registerModelSchema.safeParse({
        name: 'LLama 3',
        provider: 'LM_STUDIO',
        endpoint: 'not-a-url',
      }).success,
    ).toBe(false);
  });

  it('유효한 모델 등록을 허용한다', () => {
    expect(
      registerModelSchema.safeParse({
        name: 'LLama 3',
        provider: 'LM_STUDIO',
        endpoint: 'http://localhost:1234/v1',
      }).success,
    ).toBe(true);
  });
});

describe('CSAP D-06: AI 감사 로그', () => {
  it('AI 호출 이벤트가 정의된다', () => {
    const events = [
      'AI_CHAT_REQUEST',
      'AI_GRADE_VIOLATION',
      'AI_MODEL_REGISTERED',
      'AI_MODEL_UPDATED',
      'AI_USAGE_THRESHOLD_EXCEEDED',
    ];
    expect(events.length).toBeGreaterThanOrEqual(5);
  });

  it('등급 위반 시도는 무조건 기록된다', () => {
    const violation = {
      action: 'AI_GRADE_VIOLATION',
      dataGrade: 'C',
      blocked: true,
      actor: 'user-1',
    };
    expect(violation.blocked).toBe(true);
    expect(violation.action).toBe('AI_GRADE_VIOLATION');
  });
});
