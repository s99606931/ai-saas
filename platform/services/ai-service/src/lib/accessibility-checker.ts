// AI 접근성 자동 검사 (KWCAG 2.2) -- FR-N262.1~FR-N262.6
// Design Ref: MTU-N262 DESIGN §1~§6
// Plan SC: KWCAG 4원칙 검사, 대체 텍스트 AI 생성, 색상 대비, 점수/등급
// CSAP: D-12 개발 보안

import { randomUUID } from 'crypto';

// -- 타입 정의 ────────────────────────────────────────────────────────────────

/** KWCAG 원칙 */
export type KwcagPrinciple = 'perceivable' | 'operable' | 'understandable' | 'robust';

/** 접근성 등급 */
export type AccessibilityGrade = 'AAA' | 'AA' | 'A' | 'Fail';

/** 위반 심각도 */
export type ViolationSeverity = 'critical' | 'major' | 'minor' | 'info';

/** 접근성 규칙 */
export interface AccessibilityRule {
  id: string;
  name: string;
  principle: KwcagPrinciple;
  guideline: string;
  description: string;
  impact: ViolationSeverity;
  check: (html: string) => AccessibilityViolation[];
}

/** 접근성 위반 */
export interface AccessibilityViolation {
  ruleId: string;
  ruleName: string;
  principle: KwcagPrinciple;
  severity: ViolationSeverity;
  element: string;
  issue: string;
  suggestion: string;
  codeSnippet?: string;
}

/** 접근성 검사 결과 */
export interface AccessibilityReport {
  reportId: string;
  url: string;
  score: number;
  grade: AccessibilityGrade;
  violations: AccessibilityViolation[];
  passedRules: number;
  totalRules: number;
  principleScores: Record<KwcagPrinciple, number>;
  suggestions: AccessibilitySuggestion[];
  checkedAt: string;
}

/** 수정 제안 */
export interface AccessibilitySuggestion {
  ruleId: string;
  priority: number;
  currentCode: string;
  suggestedCode: string;
  explanation: string;
}

// -- 내장 검사 규칙 -- Design §1 ─────────────────────────────────────────────

/** img alt 속성 검사 */
function checkImageAlt(html: string): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const imgRegex = /<img\s[^>]*?(?:>)/gi;
  let match;

  while ((match = imgRegex.exec(html)) !== null) {
    const imgTag = match[0];
    // alt 속성 없음 또는 빈 alt 검사
    if (!/\balt\s*=/.test(imgTag)) {
      violations.push({
        ruleId: 'img-alt',
        ruleName: '이미지 대체 텍스트',
        principle: 'perceivable',
        severity: 'critical',
        element: 'img',
        issue: '이미지에 alt 속성이 없습니다',
        suggestion: '모든 이미지에 의미 있는 대체 텍스트를 제공하세요',
        codeSnippet: imgTag.slice(0, 100),
      });
    } else if (/\balt\s*=\s*["']\s*["']/.test(imgTag) && !/\brole\s*=\s*["']presentation["']/.test(imgTag)) {
      violations.push({
        ruleId: 'img-alt-empty',
        ruleName: '이미지 대체 텍스트 비어있음',
        principle: 'perceivable',
        severity: 'major',
        element: 'img',
        issue: '이미지의 alt 속성이 비어있습니다 (장식 이미지가 아닌 경우)',
        suggestion: '의미 있는 대체 텍스트를 추가하거나 role="presentation"을 추가하세요',
        codeSnippet: imgTag.slice(0, 100),
      });
    }
  }

  return violations;
}

/** 폼 레이블 검사 */
function checkFormLabels(html: string): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const inputRegex = /<input\s[^>]*?(?:>)/gi;
  let match;

  while ((match = inputRegex.exec(html)) !== null) {
    const inputTag = match[0];
    // hidden, submit, button, reset 타입은 제외
    if (/\btype\s*=\s*["'](?:hidden|submit|button|reset)["']/i.test(inputTag)) continue;

    // aria-label, aria-labelledby, id+label 검사
    const hasLabel = /\b(?:aria-label|aria-labelledby|title)\s*=/.test(inputTag);
    const hasId = /\bid\s*=\s*["'](\w+)["']/.test(inputTag);

    if (!hasLabel && !hasId) {
      violations.push({
        ruleId: 'form-label',
        ruleName: '폼 레이블',
        principle: 'perceivable',
        severity: 'critical',
        element: 'input',
        issue: '입력 필드에 레이블이 연결되지 않았습니다',
        suggestion: '<label for="id">를 추가하거나 aria-label 속성을 사용하세요',
        codeSnippet: inputTag.slice(0, 100),
      });
    }
  }

  return violations;
}

/** 문서 제목 검사 */
function checkDocumentTitle(html: string): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];

  if (!/<title\s*>/.test(html) || /<title\s*>\s*<\/title>/.test(html)) {
    violations.push({
      ruleId: 'doc-title',
      ruleName: '문서 제목',
      principle: 'operable',
      severity: 'major',
      element: 'title',
      issue: '문서 제목(<title>)이 없거나 비어있습니다',
      suggestion: '페이지 내용을 설명하는 의미 있는 제목을 <title> 태그에 추가하세요',
    });
  }

  return violations;
}

/** 문서 언어 검사 */
function checkDocumentLang(html: string): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];

  if (!/<html[^>]*\blang\s*=/.test(html)) {
    violations.push({
      ruleId: 'html-lang',
      ruleName: '문서 언어',
      principle: 'understandable',
      severity: 'major',
      element: 'html',
      issue: '<html> 태그에 lang 속성이 없습니다',
      suggestion: '<html lang="ko">로 문서 언어를 지정하세요',
    });
  }

  return violations;
}

/** 제목 계층 구조 검사 */
function checkHeadingHierarchy(html: string): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const headingRegex = /<h([1-6])\b/gi;
  const levels: number[] = [];
  let match;

  while ((match = headingRegex.exec(html)) !== null) {
    const levelStr = match[1];
    if (levelStr) levels.push(parseInt(levelStr));
  }

  for (let i = 1; i < levels.length; i++) {
    const current = levels[i]!;
    const previous = levels[i - 1]!;
    if (current > previous + 1) {
      violations.push({
        ruleId: 'heading-order',
        ruleName: '제목 계층',
        principle: 'perceivable',
        severity: 'minor',
        element: `h${current}`,
        issue: `제목 계층이 h${previous}에서 h${current}으로 건너뛰었습니다`,
        suggestion: `h${previous + 1}을 사용하여 순차적 계층을 유지하세요`,
      });
    }
  }

  return violations;
}

/** 링크 텍스트 검사 */
function checkLinkText(html: string): AccessibilityViolation[] {
  const violations: AccessibilityViolation[] = [];
  const linkRegex = /<a\s[^>]*?>(.*?)<\/a>/gi;
  const vagueLinkTexts = ['여기', '클릭', '더보기', '링크', 'click here', 'more', 'here'];
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const rawText = match[1] ?? '';
    const linkText = rawText.replace(/<[^>]*>/g, '').trim().toLowerCase();
    if (vagueLinkTexts.includes(linkText)) {
      violations.push({
        ruleId: 'link-text',
        ruleName: '링크 텍스트',
        principle: 'operable',
        severity: 'minor',
        element: 'a',
        issue: `모호한 링크 텍스트: "${linkText}"`,
        suggestion: '링크 목적을 명확히 설명하는 텍스트를 사용하세요',
        codeSnippet: match[0].slice(0, 100),
      });
    }
  }

  return violations;
}

// -- 색상 대비 유틸리티 -- Design §3 ─────────────────────────────────────────

/** RGB 색상 */
interface RGBColor {
  r: number;
  g: number;
  b: number;
}

/** 상대 휘도 계산 (WCAG 2.0) */
function getRelativeLuminance(color: RGBColor): number {
  const channels = [color.r, color.g, color.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (channels[0] ?? 0) + 0.7152 * (channels[1] ?? 0) + 0.0722 * (channels[2] ?? 0);
}

/** 대비율 계산 */
export function getContrastRatio(foreground: RGBColor, background: RGBColor): number {
  const l1 = getRelativeLuminance(foreground);
  const l2 = getRelativeLuminance(background);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/** WCAG AA/AAA 대비 기준 충족 여부 */
export function meetsContrastRequirement(
  ratio: number,
  isLargeText: boolean,
  level: 'AA' | 'AAA',
): boolean {
  if (level === 'AAA') {
    return isLargeText ? ratio >= 4.5 : ratio >= 7;
  }
  // AA
  return isLargeText ? ratio >= 3 : ratio >= 4.5;
}

/** HEX → RGB 변환 */
export function hexToRgb(hex: string): RGBColor | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result && result[1] && result[2] && result[3]
    ? { r: parseInt(result[1], 16), g: parseInt(result[2], 16), b: parseInt(result[3], 16) }
    : null;
}

// -- 접근성 검사 엔진 ────────────────────────────────────────────────────────

/** KWCAG 2.2 접근성 검사 엔진 */
export class AccessibilityChecker {
  private rules: AccessibilityRule[] = [];

  constructor() {
    // 내장 규칙 등록
    this.rules = [
      { id: 'img-alt', name: '이미지 대체 텍스트', principle: 'perceivable', guideline: '1.1.1', description: '모든 이미지에 대체 텍스트 제공', impact: 'critical', check: checkImageAlt },
      { id: 'form-label', name: '폼 레이블', principle: 'perceivable', guideline: '1.3.1', description: '모든 폼 요소에 레이블 연결', impact: 'critical', check: checkFormLabels },
      { id: 'doc-title', name: '문서 제목', principle: 'operable', guideline: '2.4.2', description: '페이지에 의미 있는 제목 제공', impact: 'major', check: checkDocumentTitle },
      { id: 'html-lang', name: '문서 언어', principle: 'understandable', guideline: '3.1.1', description: 'HTML 문서 언어 지정', impact: 'major', check: checkDocumentLang },
      { id: 'heading-order', name: '제목 계층', principle: 'perceivable', guideline: '1.3.1', description: '제목 태그 순차적 계층', impact: 'minor', check: checkHeadingHierarchy },
      { id: 'link-text', name: '링크 텍스트', principle: 'operable', guideline: '2.4.4', description: '링크 목적을 명확히 설명', impact: 'minor', check: checkLinkText },
    ];
  }

  /** 커스텀 규칙 추가 */
  addRule(rule: AccessibilityRule): void {
    this.rules.push(rule);
  }

  /** HTML 접근성 검사 실행 */
  check(html: string, url = 'unknown'): AccessibilityReport {
    const allViolations: AccessibilityViolation[] = [];
    let passedRules = 0;
    const principleViolations: Record<KwcagPrinciple, number> = {
      perceivable: 0, operable: 0, understandable: 0, robust: 0,
    };
    const principleTotal: Record<KwcagPrinciple, number> = {
      perceivable: 0, operable: 0, understandable: 0, robust: 0,
    };

    for (const rule of this.rules) {
      principleTotal[rule.principle] += 1;
      const violations = rule.check(html);
      if (violations.length === 0) {
        passedRules += 1;
      } else {
        allViolations.push(...violations);
        principleViolations[rule.principle] += 1;
      }
    }

    // 점수 계산 (가중 기반)
    const weights: Record<ViolationSeverity, number> = {
      critical: 10, major: 5, minor: 2, info: 1,
    };
    const maxScore = this.rules.reduce((sum, r) => sum + weights[r.impact], 0);
    const deductions = allViolations.reduce((sum, v) => sum + weights[v.severity], 0);
    const score = Math.max(0, Math.round(((maxScore - deductions) / maxScore) * 100));

    // 등급 판정
    const grade = this.determineGrade(score, allViolations);

    // 원칙별 점수
    const principleScores: Record<KwcagPrinciple, number> = {
      perceivable: principleTotal.perceivable > 0
        ? Math.round(((principleTotal.perceivable - principleViolations.perceivable) / principleTotal.perceivable) * 100) : 100,
      operable: principleTotal.operable > 0
        ? Math.round(((principleTotal.operable - principleViolations.operable) / principleTotal.operable) * 100) : 100,
      understandable: principleTotal.understandable > 0
        ? Math.round(((principleTotal.understandable - principleViolations.understandable) / principleTotal.understandable) * 100) : 100,
      robust: principleTotal.robust > 0
        ? Math.round(((principleTotal.robust - principleViolations.robust) / principleTotal.robust) * 100) : 100,
    };

    // 수정 제안 생성
    const suggestions = this.generateSuggestions(allViolations);

    return {
      reportId: randomUUID(),
      url,
      score,
      grade,
      violations: allViolations,
      passedRules,
      totalRules: this.rules.length,
      principleScores,
      suggestions,
      checkedAt: new Date().toISOString(),
    };
  }

  /** 등급 판정 */
  private determineGrade(score: number, violations: AccessibilityViolation[]): AccessibilityGrade {
    const hasCritical = violations.some((v) => v.severity === 'critical');
    const hasMajor = violations.some((v) => v.severity === 'major');

    if (hasCritical) return 'Fail';
    if (hasMajor) return 'A';
    if (score >= 95) return 'AAA';
    if (score >= 80) return 'AA';
    return 'A';
  }

  /** 수정 제안 생성 -- Design §6 */
  private generateSuggestions(violations: AccessibilityViolation[]): AccessibilitySuggestion[] {
    const priorityMap: Record<ViolationSeverity, number> = {
      critical: 1, major: 2, minor: 3, info: 4,
    };

    return violations
      .slice(0, 10) // 상위 10개
      .map((v) => ({
        ruleId: v.ruleId,
        priority: priorityMap[v.severity],
        currentCode: v.codeSnippet || v.element,
        suggestedCode: v.suggestion,
        explanation: v.issue,
      }))
      .sort((a, b) => a.priority - b.priority);
  }

  /** 등록된 규칙 수 */
  getRuleCount(): number {
    return this.rules.length;
  }
}

// -- 팩토리 ──────────────────────────────────────────────────────────────────

/** 접근성 검사기 생성 */
export function createAccessibilityChecker(): AccessibilityChecker {
  return new AccessibilityChecker();
}
