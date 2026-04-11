// Request Validator 테스트
// Design Ref: SVC-REQVALID-R28 DESIGN
// Plan SC: FR-RV.1~FR-RV.6

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  validateRequest,
  sanitizeHtml,
  sanitizeDeep,
} from '../src/request-validator.js';

describe('RequestValidator', () => {
  describe('FR-RV.1: Body 검증', () => {
    const bodySchema = z.object({
      email: z.string().email(),
      name: z.string().min(1).max(100),
      age: z.number().int().min(0).max(150),
    });

    it('유효한 body를 허용한다', () => {
      const result = validateRequest(
        { body: bodySchema },
        { body: { email: 'test@example.com', name: '홍길동', age: 30 } },
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.email).toBe('test@example.com');
        expect(result.data.body.name).toBe('홍길동');
        expect(result.data.body.age).toBe(30);
      }
    });

    it('잘못된 이메일을 거부한다', () => {
      const result = validateRequest(
        { body: bodySchema },
        { body: { email: 'invalid', name: '홍길동', age: 30 } },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors).toHaveLength(1);
        expect(result.error.errors[0].field).toBe('body.email');
      }
    });

    it('여러 필드 오류를 동시에 보고한다', () => {
      const result = validateRequest(
        { body: bodySchema },
        { body: { email: 'invalid', name: '', age: -1 } },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors.length).toBeGreaterThanOrEqual(2);
      }
    });
  });

  describe('FR-RV.2: Query String 검증', () => {
    const querySchema = z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
      search: z.string().optional(),
    });

    it('유효한 query를 허용하고 타입 변환한다', () => {
      const result = validateRequest(
        { query: querySchema },
        { query: { page: '3', limit: '50' } },
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.query.page).toBe(3);
        expect(result.data.query.limit).toBe(50);
      }
    });

    it('범위 초과 값을 거부한다', () => {
      const result = validateRequest(
        { query: querySchema },
        { query: { page: '0', limit: '200' } },
      );

      expect(result.success).toBe(false);
    });
  });

  describe('FR-RV.3: URL 경로 파라미터 검증', () => {
    const paramsSchema = z.object({
      id: z.string().uuid(),
      tenantId: z.string().min(1),
    });

    it('유효한 UUID 파라미터를 허용한다', () => {
      const result = validateRequest(
        { params: paramsSchema },
        { params: { id: '550e8400-e29b-41d4-a716-446655440000', tenantId: 'org-1' } },
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.params.id).toBe('550e8400-e29b-41d4-a716-446655440000');
      }
    });

    it('잘못된 UUID를 거부한다', () => {
      const result = validateRequest(
        { params: paramsSchema },
        { params: { id: 'not-a-uuid', tenantId: 'org-1' } },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.errors[0].field).toBe('params.id');
      }
    });
  });

  describe('FR-RV.4: RFC 7807 Problem Details', () => {
    it('에러 응답이 RFC 7807 형식을 따른다', () => {
      const schema = z.object({ name: z.string() });
      const result = validateRequest(
        { body: schema },
        { body: { name: 123 } },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.type).toBe('https://api.public-saas.go.kr/errors/validation');
        expect(result.error.title).toBe('요청 검증 실패');
        expect(result.error.status).toBe(400);
        expect(result.error.detail).toContain('검증 오류');
        expect(result.error.errors).toBeInstanceOf(Array);
        expect(result.error.errors[0]).toHaveProperty('field');
        expect(result.error.errors[0]).toHaveProperty('message');
        expect(result.error.errors[0]).toHaveProperty('code');
      }
    });

    it('body + query + params 동시 검증 실패 시 모든 에러를 포함한다', () => {
      const result = validateRequest(
        {
          body: z.object({ name: z.string() }),
          query: z.object({ page: z.number() }),
          params: z.object({ id: z.string().uuid() }),
        },
        {
          body: {},
          query: {},
          params: { id: 'bad' },
        },
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        const fields = result.error.errors.map((e) => e.field);
        expect(fields.some((f) => f.startsWith('body'))).toBe(true);
        expect(fields.some((f) => f.startsWith('query'))).toBe(true);
        expect(fields.some((f) => f.startsWith('params'))).toBe(true);
      }
    });
  });

  describe('FR-RV.5: HTML 새니타이제이션', () => {
    it('HTML 태그를 이스케이프한다', () => {
      expect(sanitizeHtml('<script>alert("xss")</script>')).toBe(
        '&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;',
      );
    });

    it('작은따옴표를 이스케이프한다', () => {
      expect(sanitizeHtml("it's")).toBe("it&#x27;s");
    });

    it('이미 이스케이프된 &amp;는 이중 이스케이프하지 않는다', () => {
      expect(sanitizeHtml('A &amp; B')).toBe('A &amp; B');
    });

    it('검증된 문자열 필드를 자동 새니타이제이션한다', () => {
      const schema = z.object({
        name: z.string(),
        bio: z.string(),
      });

      const result = validateRequest(
        { body: schema },
        { body: { name: '<b>bold</b>', bio: 'normal text' } },
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe('&lt;b&gt;bold&lt;/b&gt;');
        expect(result.data.body.bio).toBe('normal text');
      }
    });

    it('sanitize: false 옵션으로 비활성화할 수 있다', () => {
      const schema = z.object({ name: z.string() });

      const result = validateRequest(
        { body: schema },
        { body: { name: '<b>bold</b>' } },
        { sanitize: false },
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe('<b>bold</b>');
      }
    });

    it('중첩 객체와 배열을 재귀적으로 새니타이제이션한다', () => {
      const data = {
        name: '<script>',
        tags: ['<b>tag1</b>', 'tag2'],
        nested: { value: '<img onerror="xss">' },
      };

      const result = sanitizeDeep(data);
      expect(result.name).toBe('&lt;script&gt;');
      expect(result.tags[0]).toBe('&lt;b&gt;tag1&lt;/b&gt;');
      expect(result.tags[1]).toBe('tag2');
      expect(result.nested.value).toBe('&lt;img onerror=&quot;xss&quot;&gt;');
    });
  });

  describe('FR-RV.6: 타입 안전한 결과', () => {
    it('스키마 없는 필드는 undefined로 반환한다', () => {
      const result = validateRequest(
        { body: z.object({ name: z.string() }) },
        { body: { name: '홍길동' } },
      );

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.body.name).toBe('홍길동');
        expect(result.data.query).toBeUndefined();
        expect(result.data.params).toBeUndefined();
      }
    });
  });
});
