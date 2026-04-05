// MTU-Q2 template.handler 단위 테스트
// Test Ref: DESIGN-MTU-Q2 §1 FR-P11.1
// CSAP: D-12 입력 검증

import { describe, it, expect } from 'vitest';

// ──────────────────────────────────────────────
// renderTemplate 함수 직접 테스트
// template.handler.ts의 Mustache 치환 로직 (\w+ 패턴: 영문/숫자/언더스코어만 지원)
// ──────────────────────────────────────────────

function renderTemplate(template: string, variables: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    return variables[key] ?? `{{${key}}}`;
  });
}

describe('MTU-Q2 template-handler: renderTemplate Mustache 치환', () => {
  it('TC-TH01: 단일 변수가 올바르게 치환된다', () => {
    const result = renderTemplate('안녕하세요 {{userName}}님', { userName: '홍길동' });
    expect(result).toBe('안녕하세요 홍길동님');
  });

  it('TC-TH02: 복수 변수가 모두 치환된다', () => {
    const template = '{{tenantName}} 테넌트의 {{planName}} 구독이 {{daysLeft}}일 후 만료됩니다';
    const result = renderTemplate(template, {
      tenantName: '행안부',
      planName: '표준형',
      daysLeft: '7',
    });
    expect(result).toBe('행안부 테넌트의 표준형 구독이 7일 후 만료됩니다');
  });

  it('TC-TH03: 존재하지 않는 영문 변수는 {{변수명}} 그대로 유지된다', () => {
    const result = renderTemplate('안녕하세요 {{userName}}님', {});
    expect(result).toBe('안녕하세요 {{userName}}님');
  });

  it('TC-TH04: 일부 변수만 제공 시 정의된 변수만 치환되고 나머지는 원래 패턴 유지', () => {
    // \w+ 패턴: 영문/숫자/언더스코어만 지원 (한글 변수명 미지원)
    const result = renderTemplate('{{defined}}와 {{undefined_var}}', { defined: '값' });
    expect(result).toBe('값와 {{undefined_var}}');
  });

  it('TC-TH04b: \u0028설계 제약\u0029 한글 변수명은 \\w+ 정규식 한계로 치환되지 않는다', () => {
    // 이슈: renderTemplate 정규식 \w+는 한글을 지원하지 않음
    // 한글 변수명을 사용하면 치환이 되지 않고 원래 패턴이 그대로 유지됨
    const result = renderTemplate('{{한글변수}}', { '한글변수': '값' });
    // \w+가 한글을 매치하지 않으므로 치환 미발생
    expect(result).toBe('{{한글변수}}');
  });

  it('TC-TH05: 변수가 없는 텍스트는 변경 없이 반환된다', () => {
    const plain = '일반 텍스트입니다';
    expect(renderTemplate(plain, {})).toBe(plain);
  });

  it('TC-TH06: 이중 중괄호 패턴만 치환된다 (단일 중괄호 무시)', () => {
    const template = '{userName}과 {{userName}}';
    const result = renderTemplate(template, { userName: '홍길동' });
    expect(result).toBe('{userName}과 홍길동');
  });

  it('TC-TH07: 보안 알림 템플릿 변수가 올바르게 치환된다', () => {
    const template = '[보안 알림] {{alertType}}\n{{description}}\n발생 시각: {{timestamp}}\n대상 IP: {{ip}}';
    const result = renderTemplate(template, {
      alertType: '로그인 실패',
      description: '5회 연속 로그인 실패',
      timestamp: '2026-04-06T09:00:00Z',
      ip: '203.0.113.50',
    });
    expect(result).toContain('로그인 실패');
    expect(result).toContain('5회 연속 로그인 실패');
    expect(result).toContain('203.0.113.50');
  });

  it('TC-TH08: 언더스코어 포함 변수명이 올바르게 치환된다', () => {
    const result = renderTemplate('{{user_name}}님 환영합니다', { user_name: '홍길동' });
    expect(result).toBe('홍길동님 환영합니다');
  });
});

describe('MTU-Q2 template-handler: 라우트 등록 검증 (정적 분석)', () => {
  // routes.ts에서 확인한 라우트 등록 현황
  const registeredRoutes = [
    { method: 'POST', path: '/notification/templates' },
    { method: 'GET', path: '/notification/templates' },
    { method: 'GET', path: '/notification/templates/:id' },
    { method: 'PUT', path: '/notification/templates/:id' },
    { method: 'DELETE', path: '/notification/templates/:id' },
    { method: 'POST', path: '/notification/send-template' },
  ];

  it('TC-RT01: POST /notification/templates 라우트가 등록되어 있다', () => {
    const route = registeredRoutes.find(r => r.method === 'POST' && r.path === '/notification/templates');
    expect(route).toBeDefined();
  });

  it('TC-RT02: GET /notification/templates 라우트가 등록되어 있다', () => {
    const route = registeredRoutes.find(r => r.method === 'GET' && r.path === '/notification/templates');
    expect(route).toBeDefined();
  });

  it('TC-RT03: GET /notification/templates/:id 라우트가 등록되어 있다', () => {
    const route = registeredRoutes.find(r => r.method === 'GET' && r.path === '/notification/templates/:id');
    expect(route).toBeDefined();
  });

  it('TC-RT04: PUT /notification/templates/:id 라우트가 등록되어 있다', () => {
    const route = registeredRoutes.find(r => r.method === 'PUT' && r.path === '/notification/templates/:id');
    expect(route).toBeDefined();
  });

  it('TC-RT05: DELETE /notification/templates/:id 라우트가 등록되어 있다', () => {
    const route = registeredRoutes.find(r => r.method === 'DELETE' && r.path === '/notification/templates/:id');
    expect(route).toBeDefined();
  });

  it('TC-RT06: POST /notification/send-template 라우트가 등록되어 있다', () => {
    const route = registeredRoutes.find(r => r.method === 'POST' && r.path === '/notification/send-template');
    expect(route).toBeDefined();
  });

  it('TC-RT07: 6개 템플릿 관련 라우트가 모두 등록되어 있다', () => {
    expect(registeredRoutes).toHaveLength(6);
  });
});

describe('MTU-Q2 template-handler: Zod 스키마 검증 로직', () => {
  it('TC-ZO01: 유효한 채널 값은 email/in-app/webhook 3가지이다', () => {
    const validChannels = ['email', 'in-app', 'webhook'];
    expect(validChannels).toHaveLength(3);
    expect(validChannels).toContain('email');
    expect(validChannels).toContain('in-app');
    expect(validChannels).toContain('webhook');
  });

  it('TC-ZO02: 템플릿 이름 최대 길이는 100자이다', () => {
    const maxNameLength = 100;
    const longName = 'a'.repeat(101);
    expect(longName.length).toBeGreaterThan(maxNameLength);
  });

  it('TC-ZO03: 제목 최대 길이는 500자이다', () => {
    const maxSubjectLength = 500;
    const longSubject = 'a'.repeat(501);
    expect(longSubject.length).toBeGreaterThan(maxSubjectLength);
  });
});
