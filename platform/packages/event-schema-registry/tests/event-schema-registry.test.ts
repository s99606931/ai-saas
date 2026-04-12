// event-schema-registry 테스트
// Plan SC: FR-ESR.1~FR-ESR.8

import { describe, it, expect } from 'vitest';
import {
  SchemaRegistry,
  EventSchemaError,
  isBackwardCompatible,
  parse,
  compare,
  type Schema,
} from '../src/index.js';

describe('FR-ESR.2: semver', () => {
  it('parse 정상', () => {
    expect(parse('1.2.3')).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('parse 실패 → 예외', () => {
    expect(() => parse('1.2')).toThrow();
    expect(() => parse('v1.2.3')).toThrow();
  });

  it('compare major', () => {
    expect(compare('2.0.0', '1.9.9')).toBe(1);
    expect(compare('1.0.0', '2.0.0')).toBe(-1);
  });

  it('compare minor', () => {
    expect(compare('1.2.0', '1.1.9')).toBe(1);
  });

  it('compare patch', () => {
    expect(compare('1.0.2', '1.0.1')).toBe(1);
    expect(compare('1.0.0', '1.0.0')).toBe(0);
  });
});

describe('FR-ESR.1: register', () => {
  const orderSchema: Schema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      amount: { type: 'number' },
    },
    required: ['id', 'amount'],
  };

  it('정상 등록', () => {
    const reg = new SchemaRegistry();
    reg.register('order.created', '1.0.0', orderSchema);
    expect(reg.size()).toBe(1);
  });

  it('중복 등록 → 예외', () => {
    const reg = new SchemaRegistry();
    reg.register('order.created', '1.0.0', orderSchema);
    expect(() =>
      reg.register('order.created', '1.0.0', orderSchema),
    ).toThrow(/already registered/);
  });

  it('잘못된 semver → 예외', () => {
    const reg = new SchemaRegistry();
    expect(() => reg.register('x', 'bad', orderSchema)).toThrow();
  });
});

describe('FR-ESR.5, FR-ESR.6: latest, listEvents', () => {
  const schema: Schema = { type: 'object' };

  it('latest 3개 버전 중 최신', () => {
    const reg = new SchemaRegistry();
    reg.register('a', '1.0.0', schema);
    reg.register('a', '2.1.0', schema);
    reg.register('a', '1.5.3', schema);
    expect(reg.latest('a')?.version).toBe('2.1.0');
  });

  it('latest 미등록은 undefined', () => {
    const reg = new SchemaRegistry();
    expect(reg.latest('nope')).toBeUndefined();
  });

  it('listEvents 정렬', () => {
    const reg = new SchemaRegistry();
    reg.register('zebra', '1.0.0', schema);
    reg.register('apple', '1.0.0', schema);
    reg.register('apple', '2.0.0', schema);
    const list = reg.listEvents();
    expect(list[0]!.type).toBe('apple');
    expect(list[0]!.versions).toEqual(['1.0.0', '2.0.0']);
    expect(list[1]!.type).toBe('zebra');
  });
});

describe('FR-ESR.3, FR-ESR.7: validate', () => {
  const reg = new SchemaRegistry();
  reg.register('user.created', '1.0.0', {
    type: 'object',
    properties: {
      id: { type: 'string', minLength: 1 },
      age: { type: 'integer', minimum: 0 },
      role: { type: 'string', enum: ['admin', 'user'] },
      tags: { type: 'array', items: { type: 'string' } },
      profile: {
        type: 'object',
        properties: {
          city: { type: 'string' },
        },
        required: ['city'],
      },
    },
    required: ['id', 'age', 'role'],
  });

  it('정상 페이로드', () => {
    expect(() =>
      reg.validate('user.created', '1.0.0', {
        id: 'u1',
        age: 30,
        role: 'admin',
      }),
    ).not.toThrow();
  });

  it('누락 required → path 포함 에러', () => {
    try {
      reg.validate('user.created', '1.0.0', { id: 'u1' });
      expect.fail('should throw');
    } catch (err) {
      expect(err).toBeInstanceOf(EventSchemaError);
      const e = err as EventSchemaError;
      const paths = e.errors.map((x) => x.path);
      expect(paths).toContain('age');
      expect(paths).toContain('role');
    }
  });

  it('잘못된 type', () => {
    expect(() =>
      reg.validate('user.created', '1.0.0', {
        id: 'u1',
        age: 'thirty',
        role: 'admin',
      }),
    ).toThrow(EventSchemaError);
  });

  it('중첩 객체 누락', () => {
    try {
      reg.validate('user.created', '1.0.0', {
        id: 'u1',
        age: 30,
        role: 'admin',
        profile: {},
      });
      expect.fail('should throw');
    } catch (err) {
      const e = err as EventSchemaError;
      expect(e.errors[0]!.path).toBe('profile.city');
    }
  });

  it('배열 items 검증', () => {
    expect(() =>
      reg.validate('user.created', '1.0.0', {
        id: 'u1',
        age: 30,
        role: 'admin',
        tags: ['a', 'b', 'c'],
      }),
    ).not.toThrow();
    expect(() =>
      reg.validate('user.created', '1.0.0', {
        id: 'u1',
        age: 30,
        role: 'admin',
        tags: ['a', 1 as unknown as string],
      }),
    ).toThrow();
  });

  it('enum 위반', () => {
    expect(() =>
      reg.validate('user.created', '1.0.0', {
        id: 'u1',
        age: 30,
        role: 'guest',
      }),
    ).toThrow();
  });

  it('string minLength', () => {
    expect(() =>
      reg.validate('user.created', '1.0.0', {
        id: '',
        age: 30,
        role: 'admin',
      }),
    ).toThrow();
  });

  it('integer minimum', () => {
    expect(() =>
      reg.validate('user.created', '1.0.0', {
        id: 'u1',
        age: -1,
        role: 'admin',
      }),
    ).toThrow();
  });
});

describe('FR-ESR.8: strict / lenient', () => {
  it('strict 모드에서 미등록 이벤트 → 예외', () => {
    const reg = new SchemaRegistry({ strict: true });
    expect(() => reg.validate('unknown', '1.0.0', {})).toThrow(
      EventSchemaError,
    );
  });

  it('lenient 모드에서 미등록 이벤트 → 통과', () => {
    const reg = new SchemaRegistry({ strict: false });
    expect(() => reg.validate('unknown', '1.0.0', {})).not.toThrow();
  });
});

describe('FR-ESR.4: 호환성', () => {
  const base: Schema = {
    type: 'object',
    properties: {
      id: { type: 'string' },
      name: { type: 'string' },
    },
    required: ['id'],
  };

  it('optional 필드 추가 → 호환', () => {
    const next: Schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
        email: { type: 'string' },
      },
      required: ['id'],
    };
    expect(isBackwardCompatible(base, next).compatible).toBe(true);
  });

  it('required 추가 → 비호환', () => {
    const next: Schema = {
      type: 'object',
      properties: {
        id: { type: 'string' },
        name: { type: 'string' },
      },
      required: ['id', 'name'],
    };
    const result = isBackwardCompatible(base, next);
    expect(result.compatible).toBe(false);
    expect(result.reasons[0]).toContain('new required field');
  });

  it('기존 필드 type 변경 → 비호환', () => {
    const next: Schema = {
      type: 'object',
      properties: {
        id: { type: 'integer' },
        name: { type: 'string' },
      },
      required: ['id'],
    };
    expect(isBackwardCompatible(base, next).compatible).toBe(false);
  });

  it('기존 필드 제거 → 비호환', () => {
    const next: Schema = {
      type: 'object',
      properties: { id: { type: 'string' } },
      required: ['id'],
    };
    expect(isBackwardCompatible(base, next).compatible).toBe(false);
  });

  it('enum 값 제거 → 비호환', () => {
    const oldS: Schema = {
      type: 'object',
      properties: { role: { type: 'string', enum: ['a', 'b', 'c'] } },
    };
    const newS: Schema = {
      type: 'object',
      properties: { role: { type: 'string', enum: ['a', 'b'] } },
    };
    const r = isBackwardCompatible(oldS, newS);
    expect(r.compatible).toBe(false);
    expect(r.reasons[0]).toContain('enum value removed');
  });
});
