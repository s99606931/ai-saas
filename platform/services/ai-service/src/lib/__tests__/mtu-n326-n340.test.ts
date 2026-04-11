// MTU-N326~N340 통합 테스트 — 공공AI/SaaS/보안/운영 15개 모듈
// Design Ref: MTU-N326~N340 | CSAP: D-06, D-08
import { describe, it, expect } from 'vitest';

// N326 감성 분석
import { analyzeSentiment, analyzeBatch, calculateTrend, getSentimentAuditLog, type SentimentInput } from '../sentiment-analysis-engine.js';
// N327 문서 유사도
import { tokenize, buildTfIdf, cosineSimilarity, detectDuplicates, getDocSimAuditLog } from '../document-similarity-engine.js';
// N328 음성→텍스트
import { parseAudioMetadata, createSegment, normalizeText, buildTranscription, getSTTAuditLog } from '../speech-to-text-adapter.js';
// N329 서식 OCR
import { registerTemplate, validateField, extractFormData, getOcrAuditLog, type FormField } from '../form-ocr-extractor.js';
// N330 SSO
import { createSSOProvider, getSSOProviders, validateSAMLAssertion, createSSOSession, getSSOAuditLog, type SAMLAssertion } from '../tenant-sso-manager.js';
// N331 웹훅
import { registerEndpoint, computeSignature, createDelivery, simulateDeliveryAttempt, getWebhookAuditLog } from '../webhook-delivery-engine.js';
// N332 API 버전
import { registerVersion, deprecateVersion, checkCompatibility, generateMigrationGuide, getApiVerAuditLog } from '../api-versioning-manager.js';
// N333 테마
import { createTheme, getTheme, generateCSSVariables, updateTheme, validateColor, getThemeAuditLog } from '../tenant-theme-manager.js';
// N334 인증서
import { registerCertificate, getCertificates, checkExpiry, getExpiringCertificates, scheduleRenewal, getCertAuditLog } from '../certificate-manager.js';
// N335 보안 기준선
import { registerRule, getRules, runBaseline, getBaselineAuditLog } from '../security-baseline-checker.js';
// N336 접근 검토
import { detectInactive, detectOverPrivileged, detectRoleConflicts, runAccessReview, getAccessReviewAuditLog, type UserAccess } from '../access-review-automation.js';
// N337 데이터 마스킹
import { defineRule as defineMaskRule, applyMask, maskStaticData, maskDynamic, getMaskingAuditLog } from '../data-masking-engine.js';
// N338 설정 변경
import { saveSnapshot, getSnapshots, diffSnapshots, rollback, getConfigAuditLog } from '../config-change-tracker.js';
// N339 헬스체크
import { registerTarget, getTargets, simulateCheck, generateHealthReport, getHealthAuditLog } from '../health-check-orchestrator.js';
// N340 용량 예측
import { recordDataPoint, linearRegression, analyzeTrend, forecastCapacity, getCapacityAuditLog } from '../capacity-forecast-engine.js';

describe('MTU-N326 감성 분석 엔진', () => {
  it('긍정 감성 분류', () => {
    const input: SentimentInput = { textId: 't1', text: '서비스가 매우 편리하고 감사합니다', source: 'survey', category: 'feedback' };
    const r = analyzeSentiment(input);
    expect(r.sentiment).toBe('positive');
    expect(r.keywords.length).toBeGreaterThan(0);
  });
  it('부정 감성 분류', () => {
    const input: SentimentInput = { textId: 't2', text: '시스템 장애로 불편하고 느린 응답', source: 'complaint', category: 'issue' };
    const r = analyzeSentiment(input);
    expect(r.sentiment).toBe('negative');
  });
  it('배치 분석 및 감사 로그', () => {
    const inputs: SentimentInput[] = [
      { textId: 'b1', text: '좋은 서비스', source: 'web', category: 'general' },
      { textId: 'b2', text: '불만 접수', source: 'web', category: 'general' },
    ];
    const results = analyzeBatch('t-n326', inputs);
    expect(results).toHaveLength(2);
    expect(getSentimentAuditLog('t-n326').length).toBeGreaterThan(0);
  });
  it('트렌드 계산', () => {
    const results = [
      { textId: '1', sentiment: 'positive' as const, score: 0.7, confidence: 0.8, keywords: [] },
      { textId: '2', sentiment: 'negative' as const, score: 0.3, confidence: 0.6, keywords: [] },
    ];
    const trend = calculateTrend(results, '2026-04');
    expect(trend.positive).toBe(1);
    expect(trend.negative).toBe(1);
  });
});

describe('MTU-N327 문서 유사도 분석', () => {
  it('텍스트 토큰화', () => {
    const tokens = tokenize('공공기관 SaaS 프레임워크 개발');
    expect(tokens.length).toBeGreaterThan(0);
  });
  it('TF-IDF 벡터화', () => {
    const v = buildTfIdf('d1', '제목1', '공공기관 디지털 전환 사업 추진');
    expect(v.docId).toBe('d1');
    expect(Object.keys(v.terms).length).toBeGreaterThan(0);
  });
  it('코사인 유사도 계산', () => {
    const a = buildTfIdf('a', 'A', '공공기관 디지털 전환 사업');
    const b = buildTfIdf('b', 'B', '공공기관 디지털 전환 프로젝트');
    const sim = cosineSimilarity(a, b);
    expect(sim.similarity).toBeGreaterThan(0);
    expect(sim.sharedTerms.length).toBeGreaterThan(0);
  });
  it('중복 탐지 리포트', () => {
    const v1 = buildTfIdf('x1', 'X', '동일한 내용의 문서 작성 제출');
    const v2 = buildTfIdf('x2', 'Y', '동일한 내용의 문서 작성 제출');
    const report = detectDuplicates('t-n327', [v1, v2], 0.5);
    expect(report.duplicatePairs.length).toBeGreaterThanOrEqual(1);
    expect(getDocSimAuditLog('t-n327').length).toBeGreaterThan(0);
  });
});

describe('MTU-N328 음성→텍스트 어댑터', () => {
  it('음성 메타데이터 파싱', () => {
    const m = parseAudioMetadata('f1', 'meeting.wav', 3600);
    expect(m.format).toBe('wav');
    expect(m.durationSeconds).toBe(3600);
  });
  it('지원하지 않는 형식 거부', () => {
    expect(() => parseAudioMetadata('f2', 'test.avi', 100)).toThrow('지원하지 않는 음성 형식');
  });
  it('텍스트 정규화', () => {
    const t = normalizeText('  안녕하세요 .  반갑습니다 .  ');
    expect(t).not.toContain('  ');
  });
  it('트랜스크립션 생성', () => {
    const meta = parseAudioMetadata('f3', 'test.mp3', 120);
    const segs = [createSegment('A', 0, 60, '첫번째 발언'), createSegment('B', 60, 120, '두번째 발언')];
    const result = buildTranscription('t-n328', meta, segs);
    expect(result.speakerCount).toBe(2);
    expect(result.segments).toHaveLength(2);
    expect(getSTTAuditLog('t-n328').length).toBeGreaterThan(0);
  });
});

describe('MTU-N329 서식 OCR 추출', () => {
  it('서식 템플릿 등록 및 추출', () => {
    const fields: FormField[] = [
      { fieldId: 'name', name: '성명', type: 'text', required: true },
      { fieldId: 'date', name: '날짜', type: 'date', required: true, pattern: '^\\d{4}-\\d{2}-\\d{2}$' },
      { fieldId: 'amount', name: '금액', type: 'number', required: false },
    ];
    registerTemplate('ocr-tpl-1', '신청서', '민원', fields);
    const result = extractFormData('t-n329', 'ocr-tpl-1', {
      name: { value: '홍길동', confidence: 0.95 },
      date: { value: '2026/04/12', confidence: 0.9 },
      amount: { value: '₩100,000', confidence: 0.85 },
    });
    expect(result.extractions).toHaveLength(3);
    expect(result.extractions.find(e => e.fieldId === 'date')?.normalizedValue).toBe('2026-04-12');
    expect(result.extractions.find(e => e.fieldId === 'amount')?.normalizedValue).toBe('100000');
    expect(getOcrAuditLog('t-n329').length).toBeGreaterThan(0);
  });
  it('필드 검증', () => {
    const field: FormField = { fieldId: 'f', name: 'n', type: 'number', required: true };
    expect(validateField('123', field)).toBe(true);
    expect(validateField('abc', field)).toBe(false);
    expect(validateField('', field)).toBe(false);
  });
});

describe('MTU-N330 SSO 관리', () => {
  it('SSO 프로바이더 생성', () => {
    const p = createSSOProvider('t-n330', 'GPKI SSO', 'saml', 'urn:gpki', 'https://sso.example.com', 'CERT');
    expect(p.protocol).toBe('saml');
    expect(getSSOProviders('t-n330')).toHaveLength(1);
  });
  it('SAML 어설션 검증', () => {
    const provider = createSSOProvider('t-n330-v', 'Test IDP', 'saml', 'urn:test', 'https://idp.test', 'C');
    const assertion: SAMLAssertion = { assertionId: 'a1', issuer: 'urn:test', subject: 'user1', email: 'u@test.com', roles: ['user'], issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), signature: 'sig' };
    expect(validateSAMLAssertion(assertion, provider).valid).toBe(true);
  });
  it('만료된 어설션 거부', () => {
    const provider = createSSOProvider('t-n330-e', 'Test', 'saml', 'urn:t', 'https://x', 'C');
    const expired: SAMLAssertion = { assertionId: 'a2', issuer: 'urn:t', subject: 'u', email: 'e@e.com', roles: [], issuedAt: '2020-01-01', expiresAt: '2020-01-02', signature: 's' };
    expect(validateSAMLAssertion(expired, provider).valid).toBe(false);
  });
  it('SSO 세션 생성 및 감사', () => {
    const assertion: SAMLAssertion = { assertionId: 'a3', issuer: 'urn:test', subject: 'u2', email: 'u2@t.com', roles: ['admin'], issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 3600000).toISOString(), signature: 'sig2' };
    const session = createSSOSession('t-n330-s', 'p1', assertion);
    expect(session.email).toBe('u2@t.com');
    expect(getSSOAuditLog('t-n330-s').length).toBeGreaterThan(0);
  });
});

describe('MTU-N331 웹훅 엔진', () => {
  it('엔드포인트 등록', () => {
    const ep = registerEndpoint('t-n331', 'https://hook.example.com', ['user.created'], 'secret123');
    expect(ep.active).toBe(true);
  });
  it('페이로드 서명', () => {
    const sig = computeSignature({ event: 'test' }, 'secret');
    expect(sig).toMatch(/^sha256=/);
  });
  it('발송 생성 및 재시도', () => {
    const del = createDelivery('t-n331', 'ep1', 'user.created', { userId: '1' }, 'sec');
    expect(del.status).toBe('pending');
    const retried = simulateDeliveryAttempt(del, false);
    expect(retried.status).toBe('retrying');
    expect(retried.attempts).toBe(1);
    const delivered = simulateDeliveryAttempt(del, true);
    expect(delivered.status).toBe('delivered');
    expect(getWebhookAuditLog('t-n331').length).toBeGreaterThan(0);
  });
});

describe('MTU-N332 API 버전 관리', () => {
  it('버전 등록 및 폐기', () => {
    const v = registerVersion('t-n332', 'user-api', 'v1', { name: 'string', email: 'string' });
    expect(v.status).toBe('active');
    const dep = deprecateVersion('t-n332', v.versionId);
    expect(dep?.status).toBe('deprecated');
  });
  it('호환성 검증', () => {
    const old = { name: 'string', email: 'string' };
    const neu = { name: 'string', phone: 'string' };
    const result = checkCompatibility(old, neu);
    expect(result.compatible).toBe(false);
    expect(result.removedFields).toContain('email');
    expect(result.addedFields).toContain('phone');
  });
  it('마이그레이션 가이드 생성', () => {
    const compat = checkCompatibility({ a: 1 }, { b: 2 });
    const guide = generateMigrationGuide('v1', 'v2', compat);
    expect(guide.steps.length).toBeGreaterThan(0);
    expect(getApiVerAuditLog('t-n332').length).toBeGreaterThan(0);
  });
});

describe('MTU-N333 테넌트 테마', () => {
  it('테마 생성 및 조회', () => {
    const theme = createTheme('t-n333', '기본 테마', { primaryColor: '#003366' });
    expect(theme.primaryColor).toBe('#003366');
    expect(getTheme('t-n333')).not.toBeNull();
  });
  it('CSS 변수 생성', () => {
    const theme = createTheme('t-n333-css', '테스트', {});
    const vars = generateCSSVariables(theme);
    expect(vars['--color-primary']).toBeDefined();
  });
  it('유효하지 않은 색상 거부', () => {
    expect(validateColor('#gggggg')).toBe(false);
    expect(validateColor('#003366')).toBe(true);
  });
  it('테마 업데이트 및 감사', () => {
    createTheme('t-n333-u', 'update test', {});
    const updated = updateTheme('t-n333-u', { primaryColor: '#ff0000' });
    expect(updated?.primaryColor).toBe('#ff0000');
    expect(getThemeAuditLog('t-n333-u').length).toBeGreaterThan(0);
  });
});

describe('MTU-N334 인증서 관리', () => {
  it('인증서 등록', () => {
    const cert = registerCertificate('t-n334', 'example.go.kr', 'GPKI', '2026-01-01', '2027-01-01');
    expect(cert.status).toBe('active');
    expect(getCertificates('t-n334')).toHaveLength(1);
  });
  it('만료 체크', () => {
    const cert = registerCertificate('t-n334-exp', 'expired.kr', 'CA', '2020-01-01', '2020-12-31');
    const r = checkExpiry(cert);
    expect(r.expiring).toBe(true);
    expect(r.daysRemaining).toBe(0);
  });
  it('만료 임박 인증서 조회', () => {
    registerCertificate('t-n334-soon', 'soon.kr', 'CA', '2026-01-01', new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString());
    const expiring = getExpiringCertificates('t-n334-soon', 30);
    expect(expiring.length).toBeGreaterThanOrEqual(1);
  });
  it('갱신 스케줄 및 감사', () => {
    const s = scheduleRenewal('cert-123', 30);
    expect(s.status).toBe('pending');
    expect(getCertAuditLog('t-n334').length).toBeGreaterThan(0);
  });
});

describe('MTU-N335 보안 기준선 점검', () => {
  it('규칙 등록 및 점검', () => {
    registerRule('cis-1', 'access', 'SSH 접근 제한', 'root SSH 비활성화', 'critical', 'ssh_root_disabled');
    registerRule('cis-2', 'crypto', 'TLS 1.3 적용', 'TLS 1.2 이하 비활성화', 'high', 'tls_1_3_enabled');
    const config = { ssh_root_disabled: true, tls_1_3_enabled: false };
    const report = runBaseline('t-n335', config);
    expect(report.passed).toBe(1);
    expect(report.failed).toBe(1);
    expect(report.complianceRate).toBeCloseTo(0.5, 1);
    expect(getBaselineAuditLog('t-n335').length).toBeGreaterThan(0);
  });
  it('규칙 목록 조회', () => {
    expect(getRules().length).toBeGreaterThanOrEqual(2);
  });
});

describe('MTU-N336 접근 권한 검토', () => {
  const users: UserAccess[] = [
    { userId: 'u1', userName: '관리자', roles: ['super_admin', 'system_admin', 'security_admin', 'auditor'], lastLogin: null, department: 'IT', createdAt: '2025-01-01' },
    { userId: 'u2', userName: '일반사용자', roles: ['user'], lastLogin: new Date().toISOString(), department: 'HR', createdAt: '2025-06-01' },
    { userId: 'u3', userName: '상충역할', roles: ['approver', 'requester'], lastLogin: new Date().toISOString(), department: 'FIN', createdAt: '2025-03-01' },
  ];
  it('비활성 계정 탐지', () => {
    const r = detectInactive(users, 90);
    expect(r.some(a => a.userId === 'u1')).toBe(true);
  });
  it('과다 권한 탐지', () => {
    const r = detectOverPrivileged(users);
    expect(r.some(a => a.userId === 'u1')).toBe(true);
  });
  it('역할 상충 탐지', () => {
    const r = detectRoleConflicts(users);
    expect(r.some(a => a.userId === 'u3')).toBe(true);
  });
  it('전체 검토 캠페인', () => {
    const campaign = runAccessReview('t-n336', '2026-Q2 검토', users);
    expect(campaign.anomalies.length).toBeGreaterThanOrEqual(3);
    expect(getAccessReviewAuditLog('t-n336').length).toBeGreaterThan(0);
  });
});

describe('MTU-N337 데이터 마스킹', () => {
  it('마스킹 규칙 정의 및 적용', () => {
    defineMaskRule('t-n337', 'ssn', 'partial');
    defineMaskRule('t-n337', 'name', 'full');
    const results = maskStaticData('t-n337', { ssn: '901234-1234567', name: '홍길동', email: 'test@test.com' });
    expect(results.find(r => r.fieldName === 'ssn')?.masked).toContain('*');
    expect(results.find(r => r.fieldName === 'name')?.masked).toMatch(/^\*+$/);
    expect(results.find(r => r.fieldName === 'email')?.ruleApplied).toBe('none');
  });
  it('동적 마스킹', () => {
    defineMaskRule('t-n337-d', 'phone', 'partial');
    const masked = maskDynamic('t-n337-d', 'phone', '010-1234-5678');
    expect(masked).toContain('*');
    expect(getMaskingAuditLog('t-n337-d').length).toBeGreaterThan(0);
  });
  it('해시 마스킹', () => {
    const rule = { ruleId: 'r1', fieldName: 'f', type: 'hash' as const, preserveLength: false };
    const masked = applyMask('sensitive', rule);
    expect(masked).toMatch(/^hash_/);
  });
});

describe('MTU-N338 설정 변경 추적', () => {
  it('스냅샷 저장 및 이력', () => {
    saveSnapshot('t-n338', 'app-config', { debug: false, maxConn: 100 });
    saveSnapshot('t-n338', 'app-config', { debug: true, maxConn: 200 });
    const history = getSnapshots('t-n338', 'app-config');
    expect(history).toHaveLength(2);
  });
  it('diff 비교', () => {
    const snaps = getSnapshots('t-n338', 'app-config');
    const s0 = snaps[0]!;
    const s1 = snaps[1]!;
    const diffs = diffSnapshots(s0, s1);
    expect(diffs.some(d => d.property === 'debug' && d.changeType === 'modified')).toBe(true);
  });
  it('롤백 및 감사', () => {
    const restored = rollback('t-n338', 'app-config', 1);
    expect(restored).not.toBeNull();
    expect(getConfigAuditLog('t-n338').length).toBeGreaterThan(0);
  });
});

describe('MTU-N339 헬스체크 오케스트레이터', () => {
  it('대상 등록 및 조회', () => {
    registerTarget('t-n339', 'api-server', 'service', 'http://api:8080/health');
    registerTarget('t-n339', 'postgres', 'database', 'postgres://db:5432');
    expect(getTargets('t-n339')).toHaveLength(2);
  });
  it('헬스체크 실행', () => {
    const targets = getTargets('t-n339');
    const t0 = targets[0]!;
    const r = simulateCheck(t0, 50, true);
    expect(r.status).toBe('healthy');
  });
  it('종합 리포트 생성', () => {
    const targets = getTargets('t-n339');
    const results = [
      simulateCheck(targets[0]!, 50, true),
      simulateCheck(targets[1]!, 2000, true),
    ];
    const report = generateHealthReport('t-n339', results);
    expect(report.overallStatus).toBe('degraded');
    expect(report.healthyCount).toBe(1);
    expect(getHealthAuditLog('t-n339').length).toBeGreaterThan(0);
  });
});

describe('MTU-N340 용량 예측 엔진', () => {
  it('선형 회귀', () => {
    const { slope, intercept } = linearRegression([10, 20, 30, 40, 50]);
    expect(slope).toBeCloseTo(10, 0);
    expect(intercept).toBeCloseTo(10, 0);
  });
  it('데이터 기록 및 트렌드 분석', () => {
    for (let i = 0; i < 10; i++) recordDataPoint('t-n340', 'disk-1', 'usage_gb', 50 + i * 5, 'GB');
    const trend = analyzeTrend('t-n340', 'disk-1', 'usage_gb');
    expect(trend.trend).toBe('increasing');
    expect(trend.slope).toBeGreaterThan(0);
  });
  it('용량 초과 예측', () => {
    const forecast = forecastCapacity('t-n340', 'disk-1', 'usage_gb', 200, 60);
    expect(forecast.forecastedValue).toBeGreaterThan(forecast.currentValue);
    expect(forecast.alert).toBeDefined();
    expect(getCapacityAuditLog('t-n340').length).toBeGreaterThan(0);
  });
});
