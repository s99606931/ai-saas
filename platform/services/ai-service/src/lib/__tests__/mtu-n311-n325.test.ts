// MTU-N311~N325 통합 테스트 -- 15개 모듈 60+ 테스트
import { describe, it, expect } from 'vitest';

import { validateSchema, detectOutliers, calculateQualityScore, generateQualityReport, type DataSchema, type DataRecord } from '../data-quality-validator';
import { translateDocument, maskPIIForTranslation, type TranslationRequest } from '../admin-doc-translator';
import { classifyIntent, generateResponse, maskChatPII } from '../citizen-chatbot-engine';
import { evaluatePerformance, type PerformanceMetric } from '../performance-evaluator';
import { registerLaw, detectRevisions, assessRevisionImpact } from '../law-revision-tracker';
import { defineWorkflow, startWorkflow, completeStep } from '../custom-workflow-engine';
import { createRateLimitPolicy, checkRateLimit } from '../api-rate-limiter';
import { createTemplate, sendNotification } from '../multitenant-notification';
import { initBuiltInRules, scanContent } from '../dlp-engine';
import { generateDefaultRules, evaluateRequest } from '../waf-rule-generator';
import { classifyIncident, type SecurityIncident } from '../soc-incident-classifier';
import { defineSLO, recordSLIData, calculateSLOStatus, generateDashboard } from '../sli-slo-dashboard';
import { verifyBilling, type BillingItem } from '../billing-verifier';
import { detectDrift, scanInfrastructure, type InfraResource } from '../infra-drift-detector';
import { createScalingPolicy, analyzeAndRecommend, type ResourceUtilization } from '../auto-scaling-advisor';

describe('MTU-N311 공공데이터 품질 검증', () => {
  const schema: DataSchema = { fields: [{ name: 'name', type: 'string', required: true }, { name: 'age', type: 'number', required: true }, { name: 'email', type: 'string', required: false }] };
  const records: DataRecord[] = [{ name: '홍길동', age: 30, email: 'hong@test.com' }, { name: '김철수', age: 'abc' }, { age: 25 }];

  it('스키마 검증', () => { const v = validateSchema(records, schema); expect(v.length).toBeGreaterThan(0); });
  it('이상치 탐지', () => { const data = Array.from({ length: 20 }, (_, i) => ({ value: i === 10 ? 1000 : 10 + Math.random() * 5 })); const o = detectOutliers(data, 'value'); expect(o.length).toBeGreaterThanOrEqual(1); });
  it('품질 점수 산출', () => { const s = calculateQualityScore(records, schema); expect(s.overall).toBeGreaterThan(0); expect(s.overall).toBeLessThanOrEqual(1); });
  it('품질 리포트', () => { const r = generateQualityReport('t-n311', records, schema); expect(r.recordCount).toBe(3); });
});

describe('MTU-N312 행정 문서 번역', () => {
  it('PII 마스킹', () => { const m = maskPIIForTranslation('연락처: 010-1234-5678 이메일: a@b.com'); expect(m).not.toContain('010-1234-5678'); });
  it('문서 번역 (용어집 적용)', () => {
    const req: TranslationRequest = { requestId: 'r1', tenantId: 't-n312', sourceText: '행정안전부에서 기안을 진행합니다', sourceLang: 'ko', targetLang: 'en', documentType: 'official' };
    const result = translateDocument(req);
    expect(result.glossaryApplied.length).toBeGreaterThan(0);
    expect(result.translatedText).toContain('Ministry');
  });
  it('번역 신뢰도', () => {
    const req: TranslationRequest = { requestId: 'r2', tenantId: 't-n312', sourceText: '결재 완료', sourceLang: 'ko', targetLang: 'en', documentType: 'official' };
    const result = translateDocument(req);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});

describe('MTU-N313 시민 상담 챗봇', () => {
  it('의도 분류 (민원)', () => { const r = classifyIntent('민원을 신고하고 싶습니다'); expect(r.intent).toBe('civil_complaint'); });
  it('의도 분류 (서비스 안내)', () => { const r = classifyIntent('등록 신청 절차 안내 부탁합니다'); expect(r.intent).toBe('service_guide'); });
  it('응답 생성', () => { const r = generateResponse('t-n313', 'sess-1', '민원 접수 방법 알려주세요'); expect(r.message.length).toBeGreaterThan(0); });
  it('에스컬레이션', () => { const r = generateResponse('t-n313', 'sess-2', '상담원에게 연결해 주세요'); expect(r.escalated).toBe(true); });
  it('PII 마스킹', () => { const m = maskChatPII('주민번호 800101-1234567'); expect(m).toContain('[주민번호마스킹]'); });
});

describe('MTU-N314 성과 평가', () => {
  const metrics: PerformanceMetric[] = [
    { metricId: 'm1', name: '민원 처리율', target: 100, actual: 95, weight: 40, unit: '%' },
    { metricId: 'm2', name: '예산 집행률', target: 80, actual: 85, weight: 30, unit: '%' },
    { metricId: 'm3', name: '만족도', target: 90, actual: 40, weight: 30, unit: '점' },
  ];
  it('성과 평가 실행', () => { const r = evaluatePerformance('t-n314', '2026-Q1', metrics); expect(['S', 'A', 'B', 'C', 'D']).toContain(r.grade); });
  it('강점/개선점 식별', () => { const r = evaluatePerformance('t-n314-2', '2026-Q1', metrics); expect(r.improvements.length).toBeGreaterThan(0); });
});

describe('MTU-N315 법규 개정 추적', () => {
  it('법규 등록', () => { const l = registerLaw('t-n315', '개인정보 보호법', '2024-01', '보안'); expect(l.name).toBe('개인정보 보호법'); });
  it('개정 탐지', () => { const changes = detectRevisions('t-n315', 'law-1', '제1조 기존 조항\n제2조 기존 내용', '제1조 개정 조항\n제2조 기존 내용\n제3조 신설'); expect(changes.length).toBeGreaterThanOrEqual(1); });
  it('영향 평가', () => { const law = registerLaw('t-n315-2', '보안법', '1.0', '보안'); const changes = detectRevisions('t-n315-2', law.lawId, '기존 보안 조항', '개정 암호화 접근통제 조항'); const alerts = assessRevisionImpact('t-n315-2', law, changes); expect(alerts.length).toBeGreaterThanOrEqual(1); });
});

describe('MTU-N316 커스텀 워크플로우', () => {
  it('워크플로우 정의', () => {
    const wf = defineWorkflow('t-n316', '결재 프로세스', '기안->검토->결재', [
      { stepId: 's1', name: '기안', type: 'action', assignee: '기안자', nextSteps: ['s2'] },
      { stepId: 's2', name: '검토', type: 'review', assignee: '검토자', nextSteps: ['s3'] },
      { stepId: 's3', name: '결재', type: 'approval', assignee: '결재자', nextSteps: [] },
    ]);
    expect(wf.steps.length).toBe(3);
  });
  it('워크플로우 실행', () => {
    const wf = defineWorkflow('t-n316-r', '테스트', 'test', [{ stepId: 's1', name: '단계1', type: 'action', assignee: 'a', nextSteps: [] }]);
    const inst = startWorkflow('t-n316-r', wf.workflowId);
    expect(inst.status).toBe('active');
  });
  it('단계 완료', () => {
    const wf = defineWorkflow('t-n316-c', '2단계', 'test', [
      { stepId: 's1', name: '1단계', type: 'action', assignee: 'a', nextSteps: ['s2'] },
      { stepId: 's2', name: '2단계', type: 'action', assignee: 'b', nextSteps: [] },
    ]);
    const inst = startWorkflow('t-n316-c', wf.workflowId);
    const updated = completeStep('t-n316-c', inst.instanceId, 's1');
    expect(updated?.currentStepId).toBe('s2');
  });
});

describe('MTU-N317 API 속도제한', () => {
  it('정책 생성', () => { const p = createRateLimitPolicy('t-n317', '/api/data', 100, 60); expect(p.limit).toBe(100); });
  it('허용 요청', () => { createRateLimitPolicy('t-n317-a', '/api/test', 10, 60); const r = checkRateLimit('t-n317-a', '/api/test', 'client-1'); expect(r.allowed).toBe(true); });
  it('초과 차단', () => {
    createRateLimitPolicy('t-n317-b', '/api/limited', 3, 60);
    checkRateLimit('t-n317-b', '/api/limited', 'c1');
    checkRateLimit('t-n317-b', '/api/limited', 'c1');
    checkRateLimit('t-n317-b', '/api/limited', 'c1');
    const r = checkRateLimit('t-n317-b', '/api/limited', 'c1');
    expect(r.allowed).toBe(false);
    expect(r.retryAfterSeconds).toBeGreaterThan(0);
  });
});

describe('MTU-N318 멀티테넌트 알림', () => {
  it('템플릿 생성', () => { const t = createTemplate('t-n318', '환영 메일', 'email', '환영합니다', '{{name}}님 환영합니다'); expect(t.variables).toContain('name'); });
  it('알림 전송', () => {
    const t = createTemplate('t-n318-s', '안내', 'email', '안내', '{{content}}');
    const r = sendNotification('t-n318-s', t.templateId, 'email', ['user@test.com'], { content: '테스트' });
    expect(r.status).toBe('sent');
    expect(r.deliveredCount).toBe(1);
  });
});

describe('MTU-N319 DLP 엔진', () => {
  it('기본 규칙 초기화', () => { const rules = initBuiltInRules('t-n319'); expect(rules.length).toBe(5); });
  it('주민번호 탐지 차단', () => {
    initBuiltInRules('t-n319-s');
    const result = scanContent('t-n319-s', 'document.txt', '주민번호: 800101-1234567');
    expect(result.violations.length).toBeGreaterThanOrEqual(1);
    expect(result.violations.some(v => v.action === 'block')).toBe(true);
  });
  it('정상 콘텐츠 통과', () => {
    initBuiltInRules('t-n319-n');
    const result = scanContent('t-n319-n', 'normal.txt', '정상적인 문서 내용입니다');
    expect(result.violations.length).toBe(0);
  });
});

describe('MTU-N320 WAF 규칙', () => {
  it('기본 규칙 생성', () => { const rules = generateDefaultRules('t-n320'); expect(rules.length).toBe(6); });
  it('SQL Injection 탐지', () => {
    generateDefaultRules('t-n320-sqli');
    const events = evaluateRequest('t-n320-sqli', '/api/users', "'; DROP TABLE users; --", '10.0.0.1');
    expect(events.some(e => e.attackType === 'sqli')).toBe(true);
  });
  it('XSS 탐지', () => {
    generateDefaultRules('t-n320-xss');
    const events = evaluateRequest('t-n320-xss', '/search', '<script>alert(1)</script>', '10.0.0.2');
    expect(events.some(e => e.attackType === 'xss')).toBe(true);
  });
  it('정상 요청 통과', () => {
    generateDefaultRules('t-n320-ok');
    const events = evaluateRequest('t-n320-ok', '/api/data', '{"name":"홍길동"}', '10.0.0.3');
    expect(events.length).toBe(0);
  });
});

describe('MTU-N321 SOC 인시던트 분류', () => {
  it('악성코드 분류', () => {
    const incident: SecurityIncident = { incidentId: 'inc-1', tenantId: 't-n321', title: 'Malware 감염 의심', description: '악성코드 trojan 탐지', sourceIp: '10.0.0.1', affectedAssets: ['server-1'], rawLogs: 'malware detected', reportedAt: '' };
    const r = classifyIncident('t-n321', incident);
    expect(r.category).toBe('malware');
    expect(r.severity).toBe('P1');
  });
  it('피싱 분류', () => {
    const incident: SecurityIncident = { incidentId: 'inc-2', tenantId: 't-n321', title: '피싱 메일 수신', description: '사칭 이메일 발견', sourceIp: '10.0.0.2', affectedAssets: [], rawLogs: '', reportedAt: '' };
    const r = classifyIncident('t-n321-p', incident);
    expect(r.category).toBe('phishing');
  });
});

describe('MTU-N322 SLI/SLO 대시보드', () => {
  it('SLO 정의', () => { const s = defineSLO('t-n322', 'api-service', 'availability', 99.9, '%'); expect(s.target).toBe(99.9); });
  it('SLI 데이터 기록 및 상태 확인', () => {
    const slo = defineSLO('t-n322-s', 'svc', 'availability', 99.5, '%');
    recordSLIData('t-n322-s', slo.sloId, 99.8);
    recordSLIData('t-n322-s', slo.sloId, 99.9);
    const status = calculateSLOStatus('t-n322-s', slo.sloId);
    expect(status).not.toBeNull();
    // current=99.85, target=99.5, errorBudget=0.5, current > target → 'met'
    expect(status?.status).toBe('met');
  });
  it('대시보드 생성', () => {
    defineSLO('t-n322-d', 'svc', 'availability', 99.9, '%');
    const dash = generateDashboard('t-n322-d');
    expect(dash.overallHealth).toBeDefined();
  });
});

describe('MTU-N323 비용 청구 검증', () => {
  const items: BillingItem[] = [
    { itemId: 'b1', service: 'compute', description: 'VM 인스턴스', quantity: 10, unitPrice: 100000, totalPrice: 1000000, period: '2026-04' },
    { itemId: 'b2', service: 'storage', description: '블록 스토리지', quantity: 100, unitPrice: 1000, totalPrice: 100001, period: '2026-04' },
    { itemId: 'b3', service: 'compute', description: 'VM 인스턴스', quantity: 10, unitPrice: 100000, totalPrice: 1000000, period: '2026-04' },
  ];
  it('산출 오류 탐지', () => { const r = verifyBilling('t-n323', items); expect(r.discrepancies.some(d => d.type === 'calculation_error')).toBe(true); });
  it('중복 청구 탐지', () => { const r = verifyBilling('t-n323-d', items); expect(r.discrepancies.some(d => d.type === 'duplicate')).toBe(true); });
  it('절감 기회 산출', () => { const r = verifyBilling('t-n323-s', items); expect(r.savingsOpportunity).toBeGreaterThan(0); });
});

describe('MTU-N324 인프라 드리프트', () => {
  const resources: InfraResource[] = [
    { resourceId: 'r1', type: 'vm', name: 'web-server', desiredState: { cpu: 4, memory: 16, security_group: 'sg-web' }, actualState: { cpu: 4, memory: 16, security_group: 'sg-default' } },
    { resourceId: 'r2', type: 'db', name: 'main-db', desiredState: { encryption: true, size: 100 }, actualState: { encryption: true, size: 100 } },
  ];
  it('드리프트 탐지', () => { const d = detectDrift(resources[0]!); expect(d.length).toBe(1); expect(d[0]?.severity).toBe('critical'); });
  it('인프라 스캔', () => { const r = scanInfrastructure('t-n324', resources); expect(r.driftedResources).toBe(1); expect(r.complianceRate).toBe(0.5); });
  it('정상 리소스 드리프트 없음', () => { const d = detectDrift(resources[1]!); expect(d.length).toBe(0); });
});

describe('MTU-N325 자동 스케일링 권고', () => {
  it('스케일링 정책 생성', () => { const p = createScalingPolicy('t-n325', 'api-svc', 2, 10); expect(p.minReplicas).toBe(2); });
  it('스케일 아웃 권고 (CPU 높음)', () => {
    createScalingPolicy('t-n325-o', 'high-cpu', 1, 5, 70);
    const utils: ResourceUtilization[] = [{ resourceId: 'r1', serviceName: 'high-cpu', metricType: 'cpu', current: 90, peak: 95, average: 85, capacity: 100, unit: '%', timestamp: '' }];
    const recs = analyzeAndRecommend('t-n325-o', utils, 2);
    expect(recs.some(r => r.action === 'scale_out')).toBe(true);
  });
  it('스케일 인 권고 (리소스 과다)', () => {
    createScalingPolicy('t-n325-i', 'low-cpu', 1, 10, 70, 80);
    const utils: ResourceUtilization[] = [
      { resourceId: 'r1', serviceName: 'low-cpu', metricType: 'cpu', current: 10, peak: 15, average: 10, capacity: 100, unit: '%', timestamp: '' },
      { resourceId: 'r2', serviceName: 'low-cpu', metricType: 'memory', current: 15, peak: 20, average: 15, capacity: 100, unit: '%', timestamp: '' },
    ];
    const recs = analyzeAndRecommend('t-n325-i', utils, 5);
    expect(recs.some(r => r.action === 'scale_in')).toBe(true);
  });
  it('변경 불필요 (정상 범위)', () => {
    createScalingPolicy('t-n325-n', 'normal', 1, 5, 70);
    const utils: ResourceUtilization[] = [{ resourceId: 'r1', serviceName: 'normal', metricType: 'cpu', current: 50, peak: 60, average: 50, capacity: 100, unit: '%', timestamp: '' }];
    const recs = analyzeAndRecommend('t-n325-n', utils, 2);
    expect(recs.some(r => r.action === 'no_change')).toBe(true);
  });
});
