// MTU-N262 단위 테스트: KWCAG 2.2 접근성 자동 검사
// Design Ref: MTU-N262 DESIGN §1~§6
// Plan SC: FR-N262.1~FR-N262.6
// CSAP: D-12 개발 보안

import { describe, it, expect, beforeEach } from 'vitest';

import {
  AccessibilityChecker,
  createAccessibilityChecker,
  getContrastRatio,
  meetsContrastRequirement,
  hexToRgb,
} from '../../src/lib/accessibility-checker.js';

// -- 이미지 대체 텍스트 -- Design §1 ──────────────────────────────────────

describe('이미지 대체 텍스트 검사 (img-alt)', () => {
  let checker: AccessibilityChecker;

  beforeEach(() => {
    checker = createAccessibilityChecker();
  });

  it('alt 속성 없는 이미지를 위반으로 감지한다', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><img src="photo.jpg"></body></html>';
    const report = checker.check(html);
    expect(report.violations.some((v) => v.ruleId === 'img-alt')).toBe(true);
  });

  it('빈 alt 속성 이미지를 위반으로 감지한다', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><img src="photo.jpg" alt=""></body></html>';
    const report = checker.check(html);
    expect(report.violations.some((v) => v.ruleId === 'img-alt-empty')).toBe(true);
  });

  it('유효한 alt 속성은 통과', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><img src="photo.jpg" alt="사진 설명"></body></html>';
    const report = checker.check(html);
    expect(report.violations.filter((v) => v.ruleId === 'img-alt')).toHaveLength(0);
    expect(report.violations.filter((v) => v.ruleId === 'img-alt-empty')).toHaveLength(0);
  });

  it('장식 이미지 (role=presentation)는 빈 alt 허용', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><img src="bg.png" alt="" role="presentation"></body></html>';
    const report = checker.check(html);
    expect(report.violations.filter((v) => v.ruleId === 'img-alt-empty')).toHaveLength(0);
  });
});

// -- 폼 레이블 검사 -- Design §1 ──────────────────────────────────────────

describe('폼 레이블 검사 (form-label)', () => {
  let checker: AccessibilityChecker;

  beforeEach(() => {
    checker = createAccessibilityChecker();
  });

  it('레이블 없는 입력 필드를 감지한다', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><input type="text"></body></html>';
    const report = checker.check(html);
    expect(report.violations.some((v) => v.ruleId === 'form-label')).toBe(true);
  });

  it('aria-label이 있으면 통과', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><input type="text" aria-label="이름"></body></html>';
    const report = checker.check(html);
    expect(report.violations.filter((v) => v.ruleId === 'form-label')).toHaveLength(0);
  });

  it('id가 있으면 통과 (label for 연결 가능)', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><input type="text" id="name"></body></html>';
    const report = checker.check(html);
    expect(report.violations.filter((v) => v.ruleId === 'form-label')).toHaveLength(0);
  });

  it('hidden/submit/button 타입은 검사 제외', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><input type="hidden"><input type="submit"><input type="button"></body></html>';
    const report = checker.check(html);
    expect(report.violations.filter((v) => v.ruleId === 'form-label')).toHaveLength(0);
  });
});

// -- 문서 제목/언어 -- Design §1 ──────────────────────────────────────────

describe('문서 제목/언어 검사', () => {
  let checker: AccessibilityChecker;

  beforeEach(() => {
    checker = createAccessibilityChecker();
  });

  it('title 없으면 위반', () => {
    const html = '<html lang="ko"><head></head><body></body></html>';
    const report = checker.check(html);
    expect(report.violations.some((v) => v.ruleId === 'doc-title')).toBe(true);
  });

  it('빈 title이면 위반', () => {
    const html = '<html lang="ko"><head><title> </title></head><body></body></html>';
    const report = checker.check(html);
    expect(report.violations.some((v) => v.ruleId === 'doc-title')).toBe(true);
  });

  it('lang 속성 없으면 위반', () => {
    const html = '<html><head><title>페이지</title></head><body></body></html>';
    const report = checker.check(html);
    expect(report.violations.some((v) => v.ruleId === 'html-lang')).toBe(true);
  });

  it('lang 속성 있으면 통과', () => {
    const html = '<html lang="ko"><head><title>페이지</title></head><body></body></html>';
    const report = checker.check(html);
    expect(report.violations.filter((v) => v.ruleId === 'html-lang')).toHaveLength(0);
  });
});

// -- 제목 계층 검사 ─────────────────────────────────────────────────────────

describe('제목 계층 검사 (heading-order)', () => {
  let checker: AccessibilityChecker;

  beforeEach(() => {
    checker = createAccessibilityChecker();
  });

  it('h1에서 h3으로 건너뛰면 위반', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><h1>제목</h1><h3>소제목</h3></body></html>';
    const report = checker.check(html);
    expect(report.violations.some((v) => v.ruleId === 'heading-order')).toBe(true);
  });

  it('순차적 제목은 통과', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><h1>제목</h1><h2>소제목</h2><h3>본문</h3></body></html>';
    const report = checker.check(html);
    expect(report.violations.filter((v) => v.ruleId === 'heading-order')).toHaveLength(0);
  });
});

// -- 링크 텍스트 검사 ────────────────────────────────────────────────────────

describe('링크 텍스트 검사 (link-text)', () => {
  let checker: AccessibilityChecker;

  beforeEach(() => {
    checker = createAccessibilityChecker();
  });

  it('모호한 링크 텍스트를 감지한다', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><a href="/page">여기</a></body></html>';
    const report = checker.check(html);
    expect(report.violations.some((v) => v.ruleId === 'link-text')).toBe(true);
  });

  it('명확한 링크 텍스트는 통과', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body><a href="/policy">개인정보 처리방침 보기</a></body></html>';
    const report = checker.check(html);
    expect(report.violations.filter((v) => v.ruleId === 'link-text')).toHaveLength(0);
  });
});

// -- 색상 대비 유틸리티 -- Design §3 ──────────────────────────────────────

describe('색상 대비 유틸리티', () => {
  it('검정/흰색 대비율은 21:1', () => {
    const ratio = getContrastRatio({ r: 0, g: 0, b: 0 }, { r: 255, g: 255, b: 255 });
    expect(ratio).toBe(21);
  });

  it('동일 색상 대비율은 1:1', () => {
    const ratio = getContrastRatio({ r: 128, g: 128, b: 128 }, { r: 128, g: 128, b: 128 });
    expect(ratio).toBe(1);
  });

  it('AA 일반 텍스트: 4.5:1 이상', () => {
    expect(meetsContrastRequirement(4.5, false, 'AA')).toBe(true);
    expect(meetsContrastRequirement(4.4, false, 'AA')).toBe(false);
  });

  it('AA 큰 텍스트: 3:1 이상', () => {
    expect(meetsContrastRequirement(3.0, true, 'AA')).toBe(true);
    expect(meetsContrastRequirement(2.9, true, 'AA')).toBe(false);
  });

  it('AAA 일반 텍스트: 7:1 이상', () => {
    expect(meetsContrastRequirement(7.0, false, 'AAA')).toBe(true);
    expect(meetsContrastRequirement(6.9, false, 'AAA')).toBe(false);
  });

  it('AAA 큰 텍스트: 4.5:1 이상', () => {
    expect(meetsContrastRequirement(4.5, true, 'AAA')).toBe(true);
    expect(meetsContrastRequirement(4.4, true, 'AAA')).toBe(false);
  });
});

// -- hexToRgb ──────────────────────────────────────────────────────────────

describe('hexToRgb', () => {
  it('#000000 → {0,0,0}', () => {
    expect(hexToRgb('#000000')).toEqual({ r: 0, g: 0, b: 0 });
  });

  it('#FFFFFF → {255,255,255}', () => {
    expect(hexToRgb('#FFFFFF')).toEqual({ r: 255, g: 255, b: 255 });
  });

  it('#FF0000 → {255,0,0}', () => {
    expect(hexToRgb('#FF0000')).toEqual({ r: 255, g: 0, b: 0 });
  });

  it('# 없이도 변환', () => {
    expect(hexToRgb('00FF00')).toEqual({ r: 0, g: 255, b: 0 });
  });

  it('잘못된 형식은 null', () => {
    expect(hexToRgb('invalid')).toBeNull();
    expect(hexToRgb('#GGG')).toBeNull();
  });
});

// -- 보고서 종합 ─────────────────────────────────────────────────────────────

describe('AccessibilityChecker 보고서 종합', () => {
  let checker: AccessibilityChecker;

  beforeEach(() => {
    checker = createAccessibilityChecker();
  });

  it('완벽한 HTML은 높은 점수', () => {
    const html = '<html lang="ko"><head><title>페이지</title></head><body><h1>제목</h1><p>내용</p></body></html>';
    const report = checker.check(html, 'https://example.com');
    expect(report.score).toBeGreaterThanOrEqual(80);
    expect(report.url).toBe('https://example.com');
    expect(report.reportId).toBeTruthy();
  });

  it('critical 위반 시 등급 Fail', () => {
    const html = '<html><head></head><body><img src="a.jpg"><input type="text"></body></html>';
    const report = checker.check(html);
    expect(report.grade).toBe('Fail');
  });

  it('원칙별 점수를 포함한다', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body></body></html>';
    const report = checker.check(html);
    expect(report.principleScores.perceivable).toBeDefined();
    expect(report.principleScores.operable).toBeDefined();
    expect(report.principleScores.understandable).toBeDefined();
    expect(report.principleScores.robust).toBeDefined();
  });

  it('수정 제안을 포함한다', () => {
    const html = '<html><head></head><body><img src="a.jpg"></body></html>';
    const report = checker.check(html);
    expect(report.suggestions.length).toBeGreaterThan(0);
    // 심각도 순 정렬
    for (let i = 1; i < report.suggestions.length; i++) {
      expect(report.suggestions[i]!.priority).toBeGreaterThanOrEqual(report.suggestions[i - 1]!.priority);
    }
  });

  it('passedRules와 totalRules를 반환한다', () => {
    const html = '<html lang="ko"><head><title>T</title></head><body></body></html>';
    const report = checker.check(html);
    expect(report.totalRules).toBe(checker.getRuleCount());
    expect(report.passedRules).toBeLessThanOrEqual(report.totalRules);
  });

  it('커스텀 규칙을 추가할 수 있다', () => {
    checker.addRule({
      id: 'custom-test',
      name: '커스텀 테스트',
      principle: 'robust',
      guideline: '4.1.1',
      description: '커스텀 규칙',
      impact: 'info',
      check: () => [],
    });
    expect(checker.getRuleCount()).toBe(7); // 6 기본 + 1 커스텀
  });
});

// -- 팩토리 ──────────────────────────────────────────────────────────────────

describe('createAccessibilityChecker 팩토리', () => {
  it('기본 6개 규칙이 등록된다', () => {
    const checker = createAccessibilityChecker();
    expect(checker.getRuleCount()).toBe(6);
  });
});
