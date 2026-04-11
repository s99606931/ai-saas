// MTU-N341~N355 통합 테스트 — 공공AI/SaaS/보안/운영 15개 모듈
// Design Ref: MTU-N341~N355 | CSAP: D-06, D-08
import { describe, it, expect } from 'vitest';

// N341 KPI
import { registerKPI, evaluateKPI, calculateBSC, getKPIAuditLog } from '../gov-kpi-analyzer.js';
// N342 여론
import { collectOpinion, clusterByTopic, generateOpinionReport, getOpinionAuditLog } from '../public-opinion-aggregator.js';
// N343 규정 갭
import { registerItem, analyzeGaps, getCompGapAuditLog, type ComplianceStatus } from '../compliance-gap-finder.js';
// N344 보고서 템플릿
import { createTemplate, renderTemplate, getReportTplAuditLog } from '../report-template-engine.js';
// N345 사용 분석
import { recordEvent, aggregateUsage, getUsageAuditLog } from '../tenant-usage-analytics.js';
// N346 피처 토글
import { createFlag, evaluateFlag, createExperiment, assignVariant, getToggleAuditLog, type TargetRule } from '../feature-toggle-engine.js';
// N347 데이터 내보내기
import { createExportJob, executeExport, getExportAuditLog } from '../tenant-data-export.js';
// N348 게이트웨이
import { registerRoute, matchRoute, validateAuth, getGatewayAuditLog } from '../api-gateway-router.js';
// N349 세션 이상
import { recordSessionEvent, detectLocationChange, assessSessionRisk, getSessionAuditLog } from '../session-anomaly-detector.js';
// N350 비밀번호 정책
import { definePolicy, validatePassword, checkHistory, addToHistory, getPwdAuditLog } from '../password-policy-enforcer.js';
// N351 IP 평판
import { updateReputation, lookupReputation, evaluateAccess, getIPRepAuditLog } from '../ip-reputation-checker.js';
// N352 감사 로그 아카이빙
import { ingestRecord, archiveRecords, searchRecords, getArchiverAuditLog } from '../audit-log-archiver.js';
// N353 배포 추적
import { recordDeployment, getDeployments, compareDeployments, markRollback, getDeployAuditLog } from '../deployment-tracker.js';
// N354 장애 타임라인
import { createTimelineEvent, buildTimeline, correlateEvents, getTimelineAuditLog } from '../incident-timeline-builder.js';
// N355 비용 배분
import { createCostItem, allocateByUsage, generateCostReport, getTenantCosts, getCostAuditLog } from '../resource-cost-allocator.js';

describe('MTU-N341 정부 KPI 분석', () => {
  it('KPI 등록 및 평가', () => {
    const kpi = registerKPI('t-n341', '민원 처리율', 'customer', 95, '%', 2);
    const result = evaluateKPI(kpi, 100);
    expect(result.grade).toBe('A');
    expect(result.achievementRate).toBeGreaterThan(100);
  });
  it('BSC 4관점 점수', () => {
    const k1 = registerKPI('t-n341-b', '예산 집행률', 'financial', 90, '%', 1);
    const k2 = registerKPI('t-n341-b', '만족도', 'customer', 80, '점', 1);
    const results = [evaluateKPI(k1, 95), evaluateKPI(k2, 85)];
    const bsc = calculateBSC('t-n341-b', results);
    expect(bsc.financial).toBeGreaterThan(0);
    expect(bsc.customer).toBeGreaterThan(0);
    expect(getKPIAuditLog('t-n341-b').length).toBeGreaterThan(0);
  });
});

describe('MTU-N342 여론 종합 분석', () => {
  it('의견 수집 및 클러스터링', () => {
    const entries = [
      collectOpinion('web', '도로 정비 감사', '교통', 'positive'),
      collectOpinion('app', '도로 공사 소음', '교통', 'negative'),
      collectOpinion('web', '공원 조성 좋다', '환경', 'positive'),
    ];
    const clusters = clusterByTopic(entries);
    expect(clusters.length).toBe(2);
    expect(clusters.find(c => c.topic === '교통')?.count).toBe(2);
  });
  it('여론 리포트 및 감사', () => {
    const entries = [collectOpinion('w', '좋아요', 'a', 'positive'), collectOpinion('w', '싫어요', 'b', 'negative')];
    const report = generateOpinionReport('t-n342', entries);
    expect(report.totalEntries).toBe(2);
    expect(getOpinionAuditLog('t-n342').length).toBeGreaterThan(0);
  });
});

describe('MTU-N343 규정 준수 갭 탐지', () => {
  it('규정 등록 및 갭 분석', () => {
    const i1 = registerItem('t-n343', 'CSAP', 'D-08', '접근 통제', 'critical');
    const i2 = registerItem('t-n343', 'CSAP', 'D-09', '암호화', 'high');
    const statuses: ComplianceStatus[] = [
      { itemId: i1.itemId, status: 'compliant', evidence: '구현 완료', assessedAt: new Date().toISOString() },
      { itemId: i2.itemId, status: 'partial', evidence: '일부 적용', assessedAt: new Date().toISOString() },
    ];
    const report = analyzeGaps('t-n343', statuses);
    expect(report.compliant).toBe(1);
    expect(report.gaps).toHaveLength(1);
    expect(report.complianceRate).toBeCloseTo(0.5, 1);
    expect(getCompGapAuditLog('t-n343').length).toBeGreaterThan(0);
  });
});

describe('MTU-N344 보고서 템플릿', () => {
  it('템플릿 생성 및 렌더링', () => {
    createTemplate('tpl-1', '월간 보고', '정기', '{{기관명}} {{월}} 월간 보고서\n작성자: {{작성자}}');
    const result = renderTemplate('t-n344', 'tpl-1', { '기관명': '행정안전부', '월': '4월', '작성자': '김담당' });
    expect(result.content).toContain('행정안전부');
    expect(result.content).toContain('4월');
  });
  it('HTML 형식 렌더링 및 감사', () => {
    createTemplate('tpl-2', 'HTML 보고', '정기', '제목: {{title}}');
    const result = renderTemplate('t-n344-h', 'tpl-2', { title: '테스트' }, 'html');
    expect(result.format).toBe('html');
    expect(result.content).toContain('<div');
    expect(getReportTplAuditLog('t-n344-h').length).toBeGreaterThan(0);
  });
});

describe('MTU-N345 테넌트 사용 분석', () => {
  it('이벤트 기록 및 집계', () => {
    recordEvent('t-n345', 'u1', 'dashboard', 'view');
    recordEvent('t-n345', 'u1', 'report', 'export');
    recordEvent('t-n345', 'u2', 'dashboard', 'view');
    const summary = aggregateUsage('t-n345', '2026-04');
    expect(summary.totalEvents).toBe(3);
    expect(summary.uniqueUsers).toBe(2);
    expect(summary.topFeatures.length).toBeGreaterThan(0);
    expect(getUsageAuditLog('t-n345').length).toBeGreaterThan(0);
  });
});

describe('MTU-N346 피처 토글', () => {
  it('피처 플래그 생성 및 평가', () => {
    const rules: TargetRule[] = [{ ruleId: 'r1', attribute: 'department', operator: 'eq', value: 'IT' }];
    const flag = createFlag('t-n346', 'new-dashboard', true, rules);
    const eval1 = evaluateFlag(flag, { department: 'IT' });
    expect(eval1.enabled).toBe(true);
    const eval2 = evaluateFlag(flag, { department: 'HR' });
    expect(eval2.enabled).toBe(false);
  });
  it('실험 생성 및 변형 배정', () => {
    const exp = createExperiment('t-n346', 'button-color', ['red', 'blue'], { red: 50, blue: 50 });
    const variant = assignVariant(exp, 'user-1');
    expect(['red', 'blue']).toContain(variant);
    expect(getToggleAuditLog('t-n346').length).toBeGreaterThan(0);
  });
});

describe('MTU-N347 데이터 내보내기', () => {
  it('JSON 내보내기 (PII 마스킹)', () => {
    const job = createExportJob('t-n347', 'json', ['users'], true);
    expect(job.maskPII).toBe(true);
    const result = executeExport('t-n347', job, [{ name: '홍길동', email: 'test@test.com' }]);
    expect(result.recordCount).toBe(1);
    expect(result.data).toContain('홍길동');
    expect(getExportAuditLog('t-n347').length).toBeGreaterThan(0);
  });
  it('CSV 내보내기', () => {
    const job = createExportJob('t-n347-csv', 'csv', ['orders'], false);
    const result = executeExport('t-n347-csv', job, [{ id: '1', amount: '10000' }]);
    expect(result.format).toBe('csv');
    expect(result.data).toContain('id,amount');
  });
});

describe('MTU-N348 API 게이트웨이', () => {
  it('라우트 등록 및 매칭', () => {
    registerRoute('t-n348', 'GET', '/api/v1/users/{userId}', 'http://user-svc:8080');
    const m = matchRoute('t-n348', 'GET', '/api/v1/users/123');
    expect(m).not.toBeNull();
    expect(m?.params['userId']).toBe('123');
  });
  it('인증 검증', () => {
    const route = registerRoute('t-n348-a', 'POST', '/api/data', 'http://data-svc:8080', true);
    expect(validateAuth(route, null).allowed).toBe(false);
    expect(validateAuth(route, 'valid-token-123456').allowed).toBe(true);
    expect(getGatewayAuditLog('t-n348').length).toBeGreaterThan(0);
  });
});

describe('MTU-N349 세션 이상 탐지', () => {
  it('위치 변경 감지', () => {
    const events = [
      recordSessionEvent('s1', 'u1', 'login', '1.1.1.1', '서울', 'Chrome'),
      recordSessionEvent('s1', 'u1', 'action', '2.2.2.2', '부산', 'Chrome'),
    ];
    const anomalies = detectLocationChange(events);
    expect(anomalies.length).toBeGreaterThan(0);
    expect(anomalies[0]?.type).toBe('location_change');
  });
  it('위험 평가 및 감사', () => {
    const events = [
      recordSessionEvent('s2', 'u2', 'login', '1.1.1.1', '서울', 'Firefox'),
      recordSessionEvent('s2', 'u2', 'action', '1.1.1.1', '부산', 'Firefox'),
    ];
    const assessment = assessSessionRisk('t-n349', 's2', events);
    expect(assessment.overallRisk).toBeDefined();
    expect(getSessionAuditLog('t-n349').length).toBeGreaterThan(0);
  });
});

describe('MTU-N350 비밀번호 정책', () => {
  it('정책 정의 및 검증', () => {
    definePolicy('t-n350', { minLength: 10, requireSpecial: true });
    const weak = validatePassword('t-n350', 'short');
    expect(weak.valid).toBe(false);
    const strong = validatePassword('t-n350', 'SecureP@ss123');
    expect(strong.valid).toBe(true);
  });
  it('비밀번호 이력 검사', () => {
    definePolicy('t-n350-h');
    addToHistory('t-n350-h', 'u1', 'hash1');
    addToHistory('t-n350-h', 'u1', 'hash2');
    expect(checkHistory('t-n350-h', 'u1', 'hash1')).toBe(false); // 이력에 있으므로 재사용 불가
    expect(checkHistory('t-n350-h', 'u1', 'hash3')).toBe(true);  // 이력에 없으므로 사용 가능
    expect(getPwdAuditLog('t-n350-h').length).toBeGreaterThan(0);
  });
});

describe('MTU-N351 IP 평판', () => {
  it('IP 평판 업데이트 및 조회', () => {
    updateReputation('10.0.0.1', 20, ['botnet', 'scanner']);
    const rep = lookupReputation('10.0.0.1');
    expect(rep?.category).toBe('malicious');
    expect(rep?.threatTypes).toContain('botnet');
  });
  it('접근 결정', () => {
    updateReputation('10.0.0.2', 90, []);
    updateReputation('10.0.0.3', 15, ['ransomware']);
    expect(evaluateAccess('t-n351', '10.0.0.2').action).toBe('allow');
    expect(evaluateAccess('t-n351', '10.0.0.3').action).toBe('block');
    expect(evaluateAccess('t-n351', '10.0.0.99').action).toBe('allow'); // 미등록
    expect(getIPRepAuditLog('t-n351').length).toBeGreaterThan(0);
  });
});

describe('MTU-N352 감사 로그 아카이빙', () => {
  it('로그 수집 및 아카이빙', () => {
    ingestRecord('t-n352', 'admin', 'LOGIN', 'portal', '관리자 로그인');
    ingestRecord('t-n352', 'admin', 'DELETE', 'user-123', '사용자 삭제');
    const batch = archiveRecords('t-n352', new Date(Date.now() + 100000).toISOString());
    expect(batch.recordCount).toBe(2);
  });
  it('검색', () => {
    ingestRecord('t-n352-s', 'user1', 'EXPORT', 'data', '데이터 내보내기');
    const result = searchRecords('t-n352-s', 'EXPORT');
    expect(result.total).toBeGreaterThanOrEqual(1);
    expect(getArchiverAuditLog('t-n352').length).toBeGreaterThan(0);
  });
});

describe('MTU-N353 배포 이력 추적', () => {
  it('배포 기록 및 비교', () => {
    const d1 = recordDeployment('t-n353', 'api-svc', 'v1.0.0', 'staging', ['feat: 기능A'], 'deployer');
    const d2 = recordDeployment('t-n353', 'api-svc', 'v1.1.0', 'staging', ['feat: 기능A', 'fix: 버그B'], 'deployer');
    expect(getDeployments('t-n353', 'api-svc')).toHaveLength(2);
    const diffs = compareDeployments(d1, d2);
    expect(diffs.some(d => d.field === 'version')).toBe(true);
  });
  it('롤백 및 감사', () => {
    const d = recordDeployment('t-n353-r', 'web', 'v2.0', 'prod', [], 'admin');
    const rolled = markRollback('t-n353-r', 'web', d.deploymentId);
    expect(rolled?.status).toBe('rolled_back');
    expect(getDeployAuditLog('t-n353-r').length).toBeGreaterThan(0);
  });
});

describe('MTU-N354 장애 타임라인', () => {
  it('타임라인 구성', () => {
    const events = [
      createTimelineEvent('monitor', 'alert', 'CPU 100%', 'critical', '2026-04-12T10:00:00Z'),
      createTimelineEvent('log', 'log', 'OOM 에러', 'error', '2026-04-12T10:01:00Z'),
      createTimelineEvent('ops', 'action', '파드 재시작', 'info', '2026-04-12T10:05:00Z'),
      createTimelineEvent('ops', 'resolution', '정상 복구', 'info', '2026-04-12T10:10:00Z'),
    ];
    const timeline = buildTimeline('t-n354', 'inc-001', events);
    expect(timeline.events).toHaveLength(4);
    expect(timeline.duration).toBeGreaterThan(0);
    expect(timeline.rootCauses.length).toBeGreaterThan(0);
  });
  it('이벤트 상관 분석 및 감사', () => {
    const events = [
      createTimelineEvent('a', 'alert', 'x', 'warning', '2026-04-12T10:00:00Z'),
      createTimelineEvent('b', 'alert', 'y', 'warning', '2026-04-12T10:00:30Z'),
      createTimelineEvent('c', 'alert', 'z', 'warning', '2026-04-12T12:00:00Z'),
    ];
    const groups = correlateEvents(events, 60000);
    expect(groups.length).toBe(2);
    expect(getTimelineAuditLog('t-n354').length).toBeGreaterThan(0);
  });
});

describe('MTU-N355 리소스 비용 배분', () => {
  it('비용 배분 계산', () => {
    const item = createCostItem('compute', 'EC2 비용', 1000000, 'KRW');
    const allocs = allocateByUsage(item, [
      { tenantId: 'A', usage: 70, unit: 'hours' },
      { tenantId: 'B', usage: 30, unit: 'hours' },
    ]);
    expect(allocs).toHaveLength(2);
    const tenantA = allocs.find(a => a.tenantId === 'A');
    expect(tenantA?.sharePercentage).toBe(70);
    expect(tenantA?.allocatedCost).toBe(700000);
  });
  it('비용 리포트 및 감사', () => {
    const item = createCostItem('storage', 'S3 비용', 500000);
    const shares = new Map<string, { tenantId: string; usage: number; unit: string }[]>();
    shares.set(item.itemId, [{ tenantId: 'X', usage: 50, unit: 'GB' }, { tenantId: 'Y', usage: 50, unit: 'GB' }]);
    const report = generateCostReport('t-n355', '2026-04', [item], shares);
    expect(report.totalCost).toBe(500000);
    const xCosts = getTenantCosts(report.allocations, 'X');
    expect(xCosts.totalCost).toBe(250000);
    expect(getCostAuditLog('t-n355').length).toBeGreaterThan(0);
  });
});
