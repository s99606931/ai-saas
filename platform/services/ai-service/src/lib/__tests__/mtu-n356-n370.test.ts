// MTU-N356~N370 통합 테스트 — 공공AI/SaaS/보안/운영 15개 모듈
// Design Ref: MTU-N356~N370 | CSAP: D-06, D-08
import { describe, it, expect } from 'vitest';

import { profileField, analyzeDataset, getDataAnalyzerAuditLog } from '../public-data-analyzer.js';
import { defineScenario, simulate, generateImpactReport, getPolicySimAuditLog } from '../policy-simulator.js';
import { defineCategory, categorize, categorizeBatch, getFeedbackAuditLog, type FeedbackItem } from '../citizen-feedback-categorizer.js';
import { registerRisk, generateHeatmap, getRiskAuditLog } from '../gov-risk-matrix.js';
import { createInvitation, acceptInvitation, createOnboarding, completeStep, getInviteAuditLog } from '../tenant-invitation-manager.js';
import { registerCatalogItem, searchCatalog, subscribe, getCatalogAuditLog } from '../service-catalog-manager.js';
import { registerChannel, setPreference, shouldNotify, getNotifPrefAuditLog } from '../notification-preference-engine.js';
import { addResource, getTranslation, findMissingTranslations, getLangAuditLog } from '../multi-language-manager.js';
import { createFingerprint, trackDevice, getDeviceHistory, getDeviceAuditLog } from '../device-fingerprint-tracker.js';
import { defineCorrelationRule, correlateEvents, getSecCorAuditLog, type SecurityEvent } from '../security-event-correlator.js';
import { defineEvidence, collectEvidence, generateEvidencePackage, getEvidenceAuditLog } from '../compliance-evidence-collector.js';
import { detectBurst, decideAction, getAbuseAuditLog, type APICallRecord } from '../api-abuse-detector.js';
import { defineRunbook, executeRunbook, getRunbookAuditLog } from '../runbook-automation.js';
import { scheduleWindow, checkConflicts, getMaintAuditLog } from '../maintenance-window-manager.js';
import { createAlert, deduplicateAlerts, getDedupAuditLog } from '../alert-dedup-engine.js';

describe('MTU-N356 공공데이터 분석', () => {
  it('필드 프로파일링', () => {
    const p = profileField('name', ['홍길동', '김철수', null, '이영희']);
    expect(p.totalCount).toBe(4);
    expect(p.nullCount).toBe(1);
    expect(p.completeness).toBe(0.75);
  });
  it('품질 평가 및 분석', () => {
    const result = analyzeDataset('t-n356', [
      { name: '홍길동', age: '30', dept: null },
      { name: '김철수', age: '25', dept: 'IT' },
    ]);
    expect(result.recordCount).toBe(2);
    expect(result.quality.totalFields).toBe(3);
    expect(getDataAnalyzerAuditLog('t-n356').length).toBeGreaterThan(0);
  });
});

describe('MTU-N357 정책 시뮬레이션', () => {
  it('시나리오 시뮬레이션', () => {
    const scenario = defineScenario('예산 증액', { budget: 1.2, staff: 1.1 });
    const result = simulate(scenario, { budget: 1000, staff: 50 });
    expect(result.metrics['budget']).toBe(1200);
    expect(result.impact).toBe('positive');
  });
  it('영향 분석 리포트', () => {
    const s1 = defineScenario('A안', { budget: 1.5 });
    const s2 = defineScenario('B안', { budget: 0.8 });
    const report = generateImpactReport('t-n357', [s1, s2], { budget: 1000 });
    expect(report.scenarios).toHaveLength(2);
    expect(getPolicySimAuditLog('t-n357').length).toBeGreaterThan(0);
  });
});

describe('MTU-N358 피드백 분류', () => {
  it('카테고리 정의 및 분류', () => {
    defineCategory('교통', ['도로', '신호등', '주차', '교통'], 3);
    defineCategory('환경', ['쓰레기', '소음', '공원', '환경'], 2);
    const fb: FeedbackItem = { feedbackId: 'f1', content: '도로 신호등 고장 신고', source: 'app', submittedAt: new Date().toISOString() };
    const result = categorize(fb);
    expect(result.category).toBe('교통');
    expect(result.priority).toBe(3);
  });
  it('배치 분류 및 감사', () => {
    const feedbacks: FeedbackItem[] = [
      { feedbackId: 'f2', content: '공원 쓰레기 문제', source: 'web', submittedAt: '' },
      { feedbackId: 'f3', content: '교통 신호등 점검', source: 'web', submittedAt: '' },
    ];
    const results = categorizeBatch('t-n358', feedbacks);
    expect(results).toHaveLength(2);
    expect(getFeedbackAuditLog('t-n358').length).toBeGreaterThan(0);
  });
});

describe('MTU-N359 리스크 매트릭스', () => {
  it('리스크 등록 및 히트맵', () => {
    registerRisk('t-n359', '데이터 유출', '보안', 4, 5, 'DLP 도입');
    registerRisk('t-n359', '서비스 장애', '운영', 3, 3, '이중화 구성');
    registerRisk('t-n359', '예산 초과', '재무', 2, 2, '비용 모니터링');
    const heatmap = generateHeatmap('t-n359');
    expect(heatmap.totalRisks).toBe(3);
    expect(heatmap.critical).toBe(1);
    expect(getRiskAuditLog('t-n359').length).toBeGreaterThan(0);
  });
});

describe('MTU-N360 테넌트 초대', () => {
  it('초대 생성 및 수락', () => {
    const inv = createInvitation('t-n360', 'user@gov.kr', 'admin');
    expect(inv.status).toBe('pending');
    const accepted = acceptInvitation('t-n360', inv.token);
    expect(accepted?.status).toBe('accepted');
    expect(getInviteAuditLog('t-n360').length).toBeGreaterThan(0);
  });
  it('온보딩 체크리스트', () => {
    let checklist = createOnboarding('t-n360', 'u1');
    expect(checklist.completionRate).toBe(0);
    checklist = completeStep(checklist, 'ob-1');
    expect(checklist.completionRate).toBeGreaterThan(0);
  });
});

describe('MTU-N361 서비스 카탈로그', () => {
  it('항목 등록 및 검색', () => {
    registerCatalogItem('AI 문서 분석', 'AI', '공공문서 AI 분석 서비스', 'premium', 500000);
    registerCatalogItem('데이터 시각화', 'BI', '대시보드 시각화', 'basic', 100000);
    const results = searchCatalog('AI');
    expect(results.length).toBeGreaterThanOrEqual(1);
  });
  it('구독 및 감사', () => {
    const item = registerCatalogItem('보안 감사', 'Security', '보안 점검 자동화', 'premium', 300000);
    const sub = subscribe('t-n361', item.itemId);
    expect(sub.status).toBe('active');
    expect(getCatalogAuditLog('t-n361').length).toBeGreaterThan(0);
  });
});

describe('MTU-N362 알림 선호 설정', () => {
  it('선호 설정 및 필터링', () => {
    registerChannel('이메일', 'email');
    setPreference('t-n362', 'u1', { email: true, sms: false }, { security: true, marketing: false });
    expect(shouldNotify('t-n362', 'u1', 'email', 'security')).toBe(true);
    expect(shouldNotify('t-n362', 'u1', 'sms', 'security')).toBe(false);
    expect(shouldNotify('t-n362', 'u1', 'email', 'marketing')).toBe(false);
    expect(getNotifPrefAuditLog('t-n362').length).toBeGreaterThan(0);
  });
});

describe('MTU-N363 다국어 관리', () => {
  it('리소스 추가 및 번역', () => {
    addResource('ko', 'greeting', '안녕하세요');
    addResource('en', 'greeting', 'Hello');
    expect(getTranslation('ko', 'greeting')).toBe('안녕하세요');
    expect(getTranslation('en', 'greeting')).toBe('Hello');
    expect(getTranslation('ja', 'greeting')).toBe('안녕하세요'); // fallback
  });
  it('누락 번역 탐지', () => {
    addResource('ko', 'farewell', '안녕히 가세요');
    const missing = findMissingTranslations('t-n363', 'ko', ['en']);
    expect(missing.some(m => m.key === 'farewell')).toBe(true);
    expect(getLangAuditLog('t-n363').length).toBeGreaterThan(0);
  });
});

describe('MTU-N364 장치 핑거프린팅', () => {
  it('핑거프린트 생성 및 추적', () => {
    const fp1 = createFingerprint('u1', 'Chrome/100', '1920x1080', 'Asia/Seoul', 'ko');
    const alert1 = trackDevice('t-n364', 'u1', fp1);
    expect(alert1.isNew).toBe(true);
    const alert2 = trackDevice('t-n364', 'u1', fp1);
    expect(alert2.isNew).toBe(false);
    const history = getDeviceHistory('t-n364', 'u1');
    expect(history.totalDevices).toBe(1);
    expect(getDeviceAuditLog('t-n364').length).toBeGreaterThan(0);
  });
});

describe('MTU-N365 보안 이벤트 상관', () => {
  it('위협 시나리오 탐지', () => {
    defineCorrelationRule('브루트포스', ['login_failed'], 60, 3, '무차별 대입 공격');
    const events: SecurityEvent[] = [
      { eventId: 'e1', source: 'auth', type: 'login_failed', severity: 'medium', description: '로그인 실패', ip: '1.1.1.1', timestamp: '2026-04-12T10:00:00Z' },
      { eventId: 'e2', source: 'auth', type: 'login_failed', severity: 'medium', description: '로그인 실패', ip: '1.1.1.1', timestamp: '2026-04-12T10:00:10Z' },
      { eventId: 'e3', source: 'auth', type: 'login_failed', severity: 'medium', description: '로그인 실패', ip: '1.1.1.1', timestamp: '2026-04-12T10:00:20Z' },
    ];
    const threats = correlateEvents('t-n365', events);
    expect(threats.length).toBeGreaterThanOrEqual(1);
    expect(threats[0]?.threatName).toBe('무차별 대입 공격');
    expect(getSecCorAuditLog('t-n365').length).toBeGreaterThan(0);
  });
});

describe('MTU-N366 준수 증거 수집', () => {
  it('증거 정의 및 수집', () => {
    const def = defineEvidence('CSAP', 'D-06', '감사 로그 보존', 'auto');
    collectEvidence(def.evidenceId, '로그 100건 보존 확인', 'audit-log-service');
    const pkg = generateEvidencePackage('t-n366', 'CSAP');
    expect(pkg.completionRate).toBe(1);
    expect(pkg.evidences).toHaveLength(1);
    expect(getEvidenceAuditLog('t-n366').length).toBeGreaterThan(0);
  });
});

describe('MTU-N367 API 남용 탐지', () => {
  it('버스트 탐지 및 결정', () => {
    const now = Date.now();
    const calls: APICallRecord[] = Array.from({ length: 150 }, (_, i) => ({
      callId: `c${i}`, clientId: 'bad-client', endpoint: '/api/data', method: 'GET', statusCode: 200, responseTimeMs: 10, timestamp: new Date(now + i * 100).toISOString()
    }));
    const bursts = detectBurst(calls, 60000, 100);
    expect(bursts.length).toBeGreaterThanOrEqual(1);
    const decisions = decideAction('t-n367', bursts);
    expect(decisions.some(d => d.action === 'throttle' || d.action === 'block')).toBe(true);
    expect(getAbuseAuditLog('t-n367').length).toBeGreaterThan(0);
  });
});

describe('MTU-N368 런북 자동화', () => {
  it('런북 정의 및 실행', () => {
    const rb = defineRunbook('t-n368', 'DB 백업', 'PostgreSQL 백업', [
      { order: 1, name: 'DB 덤프', command: 'pg_dump', timeout: 300, rollbackCommand: null },
      { order: 2, name: '압축', command: 'gzip', timeout: 60, rollbackCommand: null },
      { order: 3, name: '업로드', command: 's3 cp', timeout: 120, rollbackCommand: null },
    ]);
    const result = executeRunbook('t-n368', rb, {});
    expect(result.status).toBe('completed');
    expect(result.stepResults).toHaveLength(3);
  });
  it('실패 시 건너뛰기', () => {
    const rb = defineRunbook('t-n368-f', '장애 복구', '서비스 복구', [
      { order: 1, name: '점검', command: 'check', timeout: 30, rollbackCommand: null },
      { order: 2, name: '재시작', command: 'restart', timeout: 60, rollbackCommand: null },
    ]);
    const result = executeRunbook('t-n368-f', rb, { 'step-1': false });
    expect(result.status).toBe('failed');
    expect(result.stepResults.find(r => r.stepId === 'step-2')?.status).toBe('skipped');
    expect(getRunbookAuditLog('t-n368').length).toBeGreaterThan(0);
  });
});

describe('MTU-N369 점검 일정 관리', () => {
  it('일정 등록 및 충돌 검사', () => {
    scheduleWindow('t-n369', 'DB 점검', '2026-04-15T02:00:00Z', '2026-04-15T04:00:00Z', ['db', 'api']);
    scheduleWindow('t-n369', 'API 점검', '2026-04-15T03:00:00Z', '2026-04-15T05:00:00Z', ['api', 'web']);
    const conflicts = checkConflicts('t-n369');
    expect(conflicts.length).toBeGreaterThanOrEqual(1);
    expect(conflicts[0]?.overlappingServices).toContain('api');
    expect(getMaintAuditLog('t-n369').length).toBeGreaterThan(0);
  });
});

describe('MTU-N370 알림 중복 제거', () => {
  it('동일 알림 그룹핑', () => {
    const alerts = [
      createAlert('monitor', 'cpu_high', 'CPU 사용률 90%', 'warning'),
      createAlert('monitor', 'cpu_high', 'CPU 사용률 95%', 'warning'),
      createAlert('monitor', 'cpu_high', 'CPU 사용률 92%', 'warning'),
      createAlert('monitor', 'disk_full', '디스크 사용률 100%', 'critical'),
    ];
    const result = deduplicateAlerts('t-n370', alerts);
    expect(result.totalAlerts).toBe(4);
    expect(result.uniqueGroups).toBe(2);
    expect(result.deduplicatedCount).toBe(2);
    expect(getDedupAuditLog('t-n370').length).toBeGreaterThan(0);
  });
});
