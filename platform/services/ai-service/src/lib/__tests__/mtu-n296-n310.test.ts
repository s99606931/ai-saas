// MTU-N296~N310 통합 테스트 -- 15개 모듈 54+ 테스트
import { describe, it, expect } from 'vitest';

// N296 회의록 AI
import {
  maskMeetingPII,
  extractAgendas,
  extractActionItems,
  generateMeetingSummary,
  getMeetingAuditLog,
  type MeetingMinutesInput,
} from '../meeting-minutes-ai';

// N297 예산 분석
import {
  classifyBudgetItem,
  detectBudgetAnomalies,
  forecastExecution,
  benchmarkBudget,
  generateBudgetReport,
  type BudgetItem,
} from '../budget-analysis-ai';

// N298 규제 샌드박스
import {
  parseRegulatoryClauses,
  identifyAffectedSectors,
  assessRisks,
  analyzeRegulatorySandbox,
} from '../regulatory-sandbox-analyzer';

// N299 입찰 분석
import {
  extractRequirements,
  assessEligibility,
  suggestBidStrategy,
  type BidNotice,
  type CompanyCapability,
} from '../procurement-bid-analyzer';

// N300 정보공개
import {
  classifySubject,
  matchNonDisclosureReasons,
  makeDisclosureDecision,
  type DisclosureRequest,
} from '../info-disclosure-reviewer';

// N301 테넌트 쿼터
import {
  createQuotaPolicy,
  recordUsage,
  checkQuotaExceedance,
  applyQuotaTemplate,
  getUsageTrend,
} from '../tenant-resource-quota';

// N302 라이선스
import {
  registerLicense,
  recordUsageMetric,
  checkLicenseExceedance,
  generateMonthlyReport,
  forecastRenewal,
} from '../license-usage-tracker';

// N303 백업/복원
import {
  createBackupPolicy,
  executeBackup,
  restoreFromBackup,
  verifyBackupIntegrity,
} from '../tenant-backup-restore';

// N304 제로트러스트
import {
  defineSegment,
  assessDeviceTrust,
  makeAccessDecision,
  detectViolation,
  type AccessRequest,
} from '../zero-trust-network';

// N305 키 관리
import {
  generateKey,
  setRotationSchedule,
  rotateKey,
  trackKeyUsage,
  destroyKey,
  checkKeyExpiry,
} from '../encryption-key-lifecycle';

// N306 위협 인텔리전스
import {
  ingestIOCFeed,
  parseSTIXBundle,
  correlateThreats,
  generateBlockPolicy,
  generateThreatReport,
} from '../threat-intelligence';

// N307 카오스 엔지니어링
import {
  createExperiment,
  setupSafetyGuards,
  executeExperiment,
  generateChaosReport,
} from '../chaos-engineering';

// N308 로그 이상 탐지
import {
  normalizeLogEntries,
  learnBaseline,
  detectLogAnomalies,
  correlateLogAnomalies,
} from '../log-anomaly-detector';

// N309 서비스 의존성 맵
import {
  discoverDependencies,
  generateTopologyMap,
  detectCircularDependencies,
  analyzeBlastRadius,
  detectDependencyChanges,
} from '../service-dependency-map';

// N310 카나리 분석
import {
  createCanaryConfig,
  compareMetrics,
  makeCanaryDecision,
  executeRollback,
  type MetricSnapshot,
} from '../canary-deploy-analyzer';


// ============================================================================
// N296 회의록 AI 요약
// ============================================================================
describe('MTU-N296 회의록 AI 요약', () => {
  it('FR-N296.1: PII 마스킹 처리', () => {
    const text = '홍길동 010-1234-5678 hong@test.com 주민번호 800101-1234567';
    const masked = maskMeetingPII(text);
    expect(masked).not.toContain('010-1234-5678');
    expect(masked).not.toContain('hong@test.com');
    expect(masked).toContain('[전화번호마스킹]');
    expect(masked).toContain('[이메일마스킹]');
  });

  it('FR-N296.2: 안건별 요약 생성', () => {
    const transcript = '안건 1: 예산 편성 방안\n결정: 2026년 예산을 10% 증액하기로 합의하였음\n\n안건 2: 인사 이동 계획\n보고사항 확인 완료';
    const agendas = extractAgendas(transcript);
    expect(agendas.length).toBeGreaterThanOrEqual(2);
    expect(agendas[0]?.topic).toBeDefined();
  });

  it('FR-N296.3: 액션아이템 추출', () => {
    const transcript = '김과장은 4월 15일까지 보고서를 작성하여 제출할 것. 이팀장은 긴급 조치 추진 바람.';
    const participants = [
      { name: '김과장', role: '과장', department: '기획팀' },
      { name: '이팀장', role: '팀장', department: '운영팀' },
    ];
    const actions = extractActionItems(transcript, participants);
    expect(actions.length).toBeGreaterThanOrEqual(1);
    expect(actions.some(a => a.assignee !== '미지정')).toBe(true);
  });

  it('FR-N296.6: 감사 로그 기록', () => {
    const input: MeetingMinutesInput = {
      meetingId: 'meet-001', tenantId: 'tenant-n296', title: '테스트 회의',
      date: '2026-04-12', participants: [{ name: '홍길동', role: '팀장', department: '기획' }],
      transcript: '안건 논의 진행 완료. 추진 사항 확인.', duration: 60,
    };
    generateMeetingSummary(input);
    const logs = getMeetingAuditLog('tenant-n296');
    expect(logs.length).toBeGreaterThanOrEqual(1);
  });
});


// ============================================================================
// N297 예산 분석
// ============================================================================
describe('MTU-N297 예산 AI 분석', () => {
  const items: BudgetItem[] = [
    { itemId: 'b1', category: '인건비', subCategory: '급여', description: '기본급여', currentAmount: 200000000, previousAmount: 100000000, executedAmount: 150000000, fiscalYear: 2026 },
    { itemId: 'b2', category: '사업비', subCategory: '용역비', description: '시스템 개발', currentAmount: 500000000, previousAmount: 500000000, executedAmount: 10000000, fiscalYear: 2026 },
    { itemId: 'b3', category: '경상비', subCategory: '여비', description: '출장비', currentAmount: 50000000, previousAmount: 80000000, executedAmount: 60000000, fiscalYear: 2026 },
  ];

  it('FR-N297.1: 예산 항목 분류', () => {
    expect(classifyBudgetItem(items[0]!)).toBe('인건비');
    expect(classifyBudgetItem(items[1]!)).toBe('사업비');
  });

  it('FR-N297.2: 이상 증감 탐지 (급증)', () => {
    const anomalies = detectBudgetAnomalies('tenant-n297', items);
    expect(anomalies.some(a => a.anomalyType === 'spike')).toBe(true);
  });

  it('FR-N297.3: 집행률 예측', () => {
    const forecasts = forecastExecution('tenant-n297', items, 6);
    expect(forecasts.length).toBeGreaterThanOrEqual(1);
    expect(forecasts.some(f => f.riskLevel !== undefined)).toBe(true);
  });

  it('FR-N297.5: 벤치마크 비교', () => {
    const comparisons = benchmarkBudget(items);
    expect(comparisons.length).toBeGreaterThanOrEqual(1);
    expect(comparisons[0]?.assessment).toBeDefined();
  });

  it('FR-N297.4: 분석 리포트 생성', () => {
    const report = generateBudgetReport('tenant-n297-rpt', items, 2026, 6);
    expect(report.fiscalYear).toBe(2026);
    expect(report.anomalies).toBeDefined();
    expect(report.forecasts).toBeDefined();
  });
});


// ============================================================================
// N298 규제 샌드박스
// ============================================================================
describe('MTU-N298 규제 샌드박스 분석', () => {
  const regText = '제1조 금지: ICT 서비스의 무허가 운영을 금지한다. 제2조 의무: 클라우드 서비스 제공자는 필수 보안 인증을 취득하여야 한다. 제3조 허용: 데이터 활용은 허용된다.';

  it('FR-N298.1: 규제 조항 분류', () => {
    const clauses = parseRegulatoryClauses(regText, '테스트법');
    expect(clauses.length).toBeGreaterThanOrEqual(2);
    expect(clauses.some(c => c.clauseType === 'prohibition')).toBe(true);
  });

  it('FR-N298.2: 영향 산업 식별', () => {
    const clauses = parseRegulatoryClauses(regText, '테스트법');
    const sectors = identifyAffectedSectors(clauses);
    expect(sectors.some(s => s.sectorName === '정보통신')).toBe(true);
  });

  it('FR-N298.3: 리스크 평가', () => {
    const clauses = parseRegulatoryClauses(regText, '테스트법');
    const sectors = identifyAffectedSectors(clauses);
    const risks = assessRisks(clauses, sectors);
    expect(risks.length).toBeGreaterThanOrEqual(1);
    expect(risks.some(r => r.riskCategory === 'legal')).toBe(true);
  });

  it('FR-N298.5: 종합 분석 리포트', () => {
    const result = analyzeRegulatorySandbox('tenant-n298', 'ICT 규제', regText, '테스트법');
    expect(result.overallRiskLevel).toBeGreaterThan(0);
    expect(result.recommendation).toBeDefined();
  });
});


// ============================================================================
// N299 입찰 분석
// ============================================================================
describe('MTU-N299 공공조달 입찰 분석', () => {
  const notice: BidNotice = {
    noticeId: 'bid-001', title: '정보시스템 구축', agency: '행안부',
    bidType: 'general', estimatedAmount: 1000000000, deadline: '2026-05-01',
    requirements: '기술력 평가: 클라우드 아키텍처 설계 경험 필수. ISMS 인증서 보유 필수. 구축 실적 3건 이상 수행 경험.',
    evaluationCriteria: 'ISO 27001 인증 보유 기관 가산점 부여',
  };

  const capability: CompanyCapability = {
    certifications: ['ISMS', 'ISO 27001', 'CSAP'],
    annualRevenue: 500000000000,
    employees: 500,
    experiences: ['클라우드 구축', '정보시스템 운영'],
    techStack: ['클라우드', '아키텍처', 'TypeScript'],
  };

  it('FR-N299.1: 요건 추출', () => {
    const reqs = extractRequirements(notice);
    expect(reqs.length).toBeGreaterThanOrEqual(1);
    expect(reqs.some(r => r.category === 'qualification' || r.category === 'certification')).toBe(true);
  });

  it('FR-N299.2: 적격성 평가', () => {
    const reqs = extractRequirements(notice);
    const assessment = assessEligibility('tenant-n299', notice, reqs, capability);
    expect(assessment.eligibilityScore).toBeGreaterThan(0);
    expect(assessment.eligible).toBeDefined();
  });

  it('FR-N299.4: 입찰 전략 제안', () => {
    const reqs = extractRequirements(notice);
    const assessment = assessEligibility('tenant-n299-s', notice, reqs, capability);
    const strategy = suggestBidStrategy(notice, assessment);
    expect(strategy.recommendedApproach).toBeDefined();
    expect(strategy.winProbability).toBeGreaterThanOrEqual(0);
  });
});


// ============================================================================
// N300 정보공개
// ============================================================================
describe('MTU-N300 정보공개 청구 자동 심사', () => {
  const request: DisclosureRequest = {
    requestId: 'disc-001', tenantId: 'tenant-n300', applicant: '국민',
    requestDate: '2026-04-01', subject: '공무원 인사 기록',
    description: '인사 발령 내역 및 개인정보 포함 문서', targetInfo: '인사 기록부',
    purpose: '정보공개 청구',
  };

  it('FR-N300.1: 주제 분류', () => {
    const category = classifySubject(request);
    expect(category).toBe('행정');
  });

  it('FR-N300.2: 비공개 사유 매칭', () => {
    const reasons = matchNonDisclosureReasons(request);
    expect(reasons.some(r => r.reasonNo === 6)).toBe(true); // 개인정보
  });

  it('FR-N300.3: 심사 결정', () => {
    const decision = makeDisclosureDecision('tenant-n300', request);
    expect(['full_disclosure', 'partial_disclosure', 'non_disclosure']).toContain(decision.decision);
    expect(decision.confidenceScore).toBeGreaterThan(0);
  });
});


// ============================================================================
// N301 테넌트 쿼터
// ============================================================================
describe('MTU-N301 테넌트 리소스 쿼터', () => {
  it('FR-N301.1: 쿼터 정책 CRUD', () => {
    const policy = createQuotaPolicy('tenant-n301', 'cpu', 16, 'cores');
    expect(policy.resourceType).toBe('cpu');
    expect(policy.limit).toBe(16);
  });

  it('FR-N301.2: 사용량 추적', () => {
    createQuotaPolicy('tenant-n301-u', 'api_calls', 100000, 'calls');
    const record = recordUsage('tenant-n301-u', 'api_calls', 50000);
    expect(record.usageRate).toBeLessThan(1);
  });

  it('FR-N301.3: 초과 감지', () => {
    createQuotaPolicy('tenant-n301-e', 'storage', 100, 'GB');
    const alert = checkQuotaExceedance('tenant-n301-e', 'storage', 110);
    expect(alert).not.toBeNull();
    expect(alert?.alertType).toBe('blocked');
  });

  it('FR-N301.5: 템플릿 적용', () => {
    const policies = applyQuotaTemplate('tenant-n301-t', 'small');
    expect(policies.length).toBe(6);
  });

  it('FR-N301.4: 사용량 트렌드', () => {
    createQuotaPolicy('tenant-n301-tr', 'cpu', 16, 'cores');
    recordUsage('tenant-n301-tr', 'cpu', 8);
    recordUsage('tenant-n301-tr', 'cpu', 10);
    const trend = getUsageTrend('tenant-n301-tr', 'cpu');
    expect(trend.dataPoints.length).toBe(2);
  });
});


// ============================================================================
// N302 라이선스 추적
// ============================================================================
describe('MTU-N302 SaaS 라이선스 추적', () => {
  it('FR-N302.1: 라이선스 등록', () => {
    const lic = registerLicense('tenant-n302', 'per_user', '기본 라이선스', 100, 'users', '2027-04-12');
    expect(lic.licenseType).toBe('per_user');
    expect(lic.limit).toBe(100);
  });

  it('FR-N302.2: 사용량 메트릭 기록', () => {
    const lic = registerLicense('tenant-n302-m', 'per_user', '메트릭', 50, 'users', '2027-12-31');
    const metric = recordUsageMetric('tenant-n302-m', lic.licenseId, 30);
    expect(metric.usageRate).toBeCloseTo(0.6, 1);
  });

  it('FR-N302.3: 초과 감지', () => {
    const lic = registerLicense('tenant-n302-e', 'per_user', '초과', 10, 'users', '2027-12-31');
    const alert = checkLicenseExceedance('tenant-n302-e', lic.licenseId, 12);
    expect(alert).not.toBeNull();
    expect(alert?.alertType).toBe('exceeded');
  });

  it('FR-N302.4: 월별 리포트', () => {
    const report = generateMonthlyReport('tenant-n302', '2026-04');
    expect(report.period).toBe('2026-04');
  });

  it('FR-N302.5: 갱신 예측', () => {
    registerLicense('tenant-n302-r', 'per_user', '갱신', 100, 'users', '2026-05-01');
    const forecasts = forecastRenewal('tenant-n302-r');
    expect(forecasts.length).toBeGreaterThanOrEqual(1);
    expect(forecasts[0]?.daysRemaining).toBeDefined();
  });
});


// ============================================================================
// N303 백업/복원
// ============================================================================
describe('MTU-N303 테넌트 백업/복원', () => {
  it('FR-N303.1: 백업 정책 생성', () => {
    const policy = createBackupPolicy('tenant-n303', 'full', 'daily', 30);
    expect(policy.backupType).toBe('full');
    expect(policy.encryptionEnabled).toBe(true);
  });

  it('FR-N303.2: 백업 실행', () => {
    const policy = createBackupPolicy('tenant-n303-b', 'incremental', 'daily');
    const backup = executeBackup('tenant-n303-b', policy.policyId);
    expect(backup.status).toBe('completed');
    expect(backup.checksum).toContain('sha256:');
  });

  it('FR-N303.3: 복원 실행', () => {
    const policy = createBackupPolicy('tenant-n303-r', 'full', 'daily');
    const backup = executeBackup('tenant-n303-r', policy.policyId);
    const restore = restoreFromBackup('tenant-n303-r', backup.backupId);
    expect(restore.status).toBe('completed');
    expect(restore.restoreType).toBe('full');
  });

  it('FR-N303.4: 무결성 검증', () => {
    const policy = createBackupPolicy('tenant-n303-v', 'full', 'weekly');
    const backup = executeBackup('tenant-n303-v', policy.policyId);
    const check = verifyBackupIntegrity('tenant-n303-v', backup.backupId);
    expect(check.checksumValid).toBe(true);
    expect(check.dataIntegrity).toBe(true);
  });
});


// ============================================================================
// N304 제로트러스트
// ============================================================================
describe('MTU-N304 제로트러스트 네트워크', () => {
  it('FR-N304.1: 세그먼트 정의', () => {
    const seg = defineSegment('tenant-n304', 'DB 영역', ['postgres', 'redis'], 'restricted');
    expect(seg.dataClassification).toBe('restricted');
  });

  it('FR-N304.2: 디바이스 신뢰도 평가', () => {
    const trust = assessDeviceTrust('user-001', 'dev-001', {
      deviceType: 'managed', osVersion: 'Windows 11', patchLevel: 'current',
      encryptionEnabled: true, antivirusActive: true,
    });
    expect(trust.trustScore).toBe(100);
  });

  it('FR-N304.2: BYOD 감점', () => {
    const trust = assessDeviceTrust('user-002', 'dev-002', {
      deviceType: 'byod', osVersion: 'macOS 14', patchLevel: 'outdated',
      encryptionEnabled: false, antivirusActive: false,
    });
    expect(trust.trustScore).toBeLessThan(50);
  });

  it('FR-N304.3: 접근 결정 (허용)', () => {
    defineSegment('tenant-n304-d', '웹 서비스', ['api-gateway'], 'internal');
    const trust = assessDeviceTrust('user-003', 'dev-003', {
      deviceType: 'managed', osVersion: 'Win 11', patchLevel: 'current',
      encryptionEnabled: true, antivirusActive: true,
    });
    const request: AccessRequest = {
      requestId: 'req-001', userId: 'user-003', deviceId: 'dev-003',
      sourceIp: '10.0.0.1', targetService: 'api-gateway', targetSegment: '웹 서비스',
      requestedAction: 'read', timestamp: new Date().toISOString(),
    };
    const decision = makeAccessDecision('tenant-n304-d', request, trust);
    expect(decision.decision).toBe('allow');
  });

  it('FR-N304.4: 위반 탐지', () => {
    const trust = assessDeviceTrust('user-bad', 'dev-bad', {
      deviceType: 'unknown', osVersion: 'unknown', patchLevel: 'critical',
      encryptionEnabled: false, antivirusActive: false,
    });
    const request: AccessRequest = {
      requestId: 'req-bad', userId: 'user-bad', deviceId: 'dev-bad',
      sourceIp: '192.168.1.100', targetService: 'admin-panel', targetSegment: 'restricted',
      requestedAction: 'write', timestamp: new Date().toISOString(),
    };
    const decision = makeAccessDecision('tenant-n304-v', request, trust);
    const violation = detectViolation('tenant-n304-v', request, decision);
    if (decision.decision !== 'allow') {
      expect(violation).not.toBeNull();
    }
  });
});


// ============================================================================
// N305 키 관리
// ============================================================================
describe('MTU-N305 암호화 키 수명주기', () => {
  it('FR-N305.1: 키 생성', () => {
    const key = generateKey('tenant-n305', 'AES-256', 'encryption');
    expect(key.algorithm).toBe('AES-256');
    expect(key.status).toBe('active');
  });

  it('FR-N305.2: 키 회전 스케줄', () => {
    const key = generateKey('tenant-n305-r', 'AES-256', 'encryption');
    const schedule = setRotationSchedule('tenant-n305-r', key.keyId, 90);
    expect(schedule.intervalDays).toBe(90);
    expect(schedule.autoRotate).toBe(true);
  });

  it('FR-N305.2: 키 회전 실행', () => {
    const key = generateKey('tenant-n305-rot', 'RSA-2048', 'signing');
    const newKey = rotateKey('tenant-n305-rot', key.keyId);
    expect(newKey).not.toBeNull();
    expect(newKey?.algorithm).toBe('RSA-2048');
  });

  it('FR-N305.3: 키 사용 추적', () => {
    const key = generateKey('tenant-n305-u', 'AES-256', 'encryption');
    const event = trackKeyUsage('tenant-n305-u', key.keyId, 'encrypt', 'ai-service');
    expect(event.operation).toBe('encrypt');
  });

  it('FR-N305.5: 키 안전 폐기', () => {
    const key = generateKey('tenant-n305-d', 'AES-128', 'encryption');
    const destroyed = destroyKey('tenant-n305-d', key.keyId);
    expect(destroyed).toBe(true);
  });

  it('FR-N305.4: 키 만료 알림', () => {
    generateKey('tenant-n305-exp', 'AES-256', 'encryption', 5); // 5일 후 만료
    const alerts = checkKeyExpiry('tenant-n305-exp');
    expect(alerts.length).toBeGreaterThanOrEqual(1);
    expect(alerts[0]?.alertType).toBe('urgent');
  });
});


// ============================================================================
// N306 위협 인텔리전스
// ============================================================================
describe('MTU-N306 위협 인텔리전스', () => {
  it('FR-N306.1: IOC 피드 수집', () => {
    const iocs = ingestIOCFeed('tenant-n306', [
      { type: 'ip', value: '192.168.1.100', threatLevel: 'high', source: 'KISA' },
      { type: 'domain', value: 'malware.example.com', threatLevel: 'critical', source: 'KISA' },
    ]);
    expect(iocs.length).toBe(2);
    expect(iocs[0]?.confidence).toBeGreaterThan(0);
  });

  it('FR-N306.2: STIX 번들 파싱', () => {
    const iocs = parseSTIXBundle('tenant-n306-stix', {
      type: 'bundle', id: 'bundle-001',
      objects: [
        { type: 'indicator', pattern: "[ipv4-addr:value = '10.0.0.1']", name: 'Test IOC', labels: ['malware'] },
        { type: 'indicator', pattern: "[domain-name:value = 'bad.example.com']", labels: ['phishing'] },
      ],
    });
    expect(iocs.length).toBe(2);
  });

  it('FR-N306.3: 위협 상관 분석', () => {
    ingestIOCFeed('tenant-n306-c', [{ type: 'ip', value: '10.10.10.10', threatLevel: 'high', source: 'CTI' }]);
    const matches = correlateThreats('tenant-n306-c', [
      { source: 'firewall_log', value: 'src=10.10.10.10 dst=192.168.0.1', timestamp: new Date().toISOString() },
    ]);
    expect(matches.length).toBeGreaterThanOrEqual(1);
  });

  it('FR-N306.4: 자동 차단 정책', () => {
    ingestIOCFeed('tenant-n306-b', [{ type: 'ip', value: '99.99.99.99', threatLevel: 'critical', source: 'CTI' }]);
    const matches = correlateThreats('tenant-n306-b', [
      { source: 'access_log', value: '99.99.99.99 GET /admin', timestamp: new Date().toISOString() },
    ]);
    if (matches.length > 0) {
      const policy = generateBlockPolicy('tenant-n306-b', matches[0]!);
      expect(policy.action).toBe('block');
    }
  });

  it('FR-N306.5: 위협 리포트', () => {
    const report = generateThreatReport('tenant-n306', '2026-04');
    expect(report.totalIOCs).toBeGreaterThanOrEqual(0);
  });
});


// ============================================================================
// N307 카오스 엔지니어링
// ============================================================================
describe('MTU-N307 카오스 엔지니어링', () => {
  it('FR-N307.1: 실험 시나리오 생성', () => {
    const exp = createExperiment('tenant-n307', '네트워크 지연 테스트', 'network_latency', 'api-gateway', 60);
    expect(exp.faultType).toBe('network_latency');
    expect(exp.status).toBe('draft');
  });

  it('FR-N307.3: 안전 장치 설정', () => {
    const exp = createExperiment('tenant-n307-g', '프로세스 종료', 'process_kill', 'worker-service');
    const guards = setupSafetyGuards(exp.experimentId);
    expect(guards.length).toBe(4);
    expect(guards.every(g => g.enabled)).toBe(true);
  });

  it('FR-N307.2: 장애 주입 실행', () => {
    const exp = createExperiment('tenant-n307-e', 'CPU 스트레스', 'cpu_stress', 'compute-service', 30);
    const result = executeExperiment('tenant-n307-e', exp.experimentId);
    expect(['success', 'degraded', 'failure']).toContain(result.status);
    expect(result.recoveryTimeSeconds).toBeGreaterThan(0);
  });

  it('FR-N307.5: 실험 리포트', () => {
    const exp = createExperiment('tenant-n307-r', '디스크 풀', 'disk_full', 'storage-service');
    executeExperiment('tenant-n307-r', exp.experimentId);
    const report = generateChaosReport('tenant-n307-r', exp.experimentId);
    expect(report).not.toBeNull();
    expect(report?.resilienceScore).toBeDefined();
  });
});


// ============================================================================
// N308 로그 이상 탐지
// ============================================================================
describe('MTU-N308 로그 이상 패턴 탐지', () => {
  it('FR-N308.1: 로그 정규화', () => {
    const logs = normalizeLogEntries([
      { timestamp: '2026-04-12T10:00:00Z', service: 'api', level: 'ERROR', message: 'Connection timeout' },
      { timestamp: '2026-04-12T10:01:00Z', service: 'api', level: 'warning', message: 'Slow query' },
    ]);
    expect(logs.length).toBe(2);
    expect(logs[0]?.level).toBe('error');
    expect(logs[1]?.level).toBe('warn');
  });

  it('FR-N308.2: 기준선 학습', () => {
    const logs = normalizeLogEntries(
      Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        service: 'test-svc', level: i % 20 === 0 ? 'error' : 'info', message: `Log ${i}`,
      })),
    );
    const baseline = learnBaseline('tenant-n308', 'test-svc', logs);
    expect(baseline.avgLogVolume).toBe(100);
    expect(baseline.avgErrorRate).toBeCloseTo(0.05, 1);
  });

  it('FR-N308.3: 이상 패턴 탐지 (에러 급증)', () => {
    // 먼저 기준선 학습
    const normalLogs = normalizeLogEntries(
      Array.from({ length: 100 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        service: 'svc-spike', level: i % 50 === 0 ? 'error' : 'info', message: `Normal ${i}`,
      })),
    );
    learnBaseline('tenant-n308-s', 'svc-spike', normalLogs);

    // 에러 급증 로그
    const spikeLogs = normalizeLogEntries(
      Array.from({ length: 50 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 1000).toISOString(),
        service: 'svc-spike', level: i % 3 === 0 ? 'error' : 'info', message: `Spike ${i}`,
      })),
    );
    const anomalies = detectLogAnomalies('tenant-n308-s', 'svc-spike', spikeLogs);
    expect(anomalies.some(a => a.anomalyType === 'error_spike')).toBe(true);
  });

  it('FR-N308.4: 상관 분석', () => {
    const anomalies = [
      { anomalyId: 'a1', tenantId: 't', service: 'svc-a', anomalyType: 'error_spike' as const, severity: 'critical' as const, description: 'test', affectedLogs: [], detectedAt: '' },
      { anomalyId: 'a2', tenantId: 't', service: 'svc-b', anomalyType: 'silence' as const, severity: 'high' as const, description: 'test', affectedLogs: [], detectedAt: '' },
    ];
    const correlation = correlateLogAnomalies('tenant-n308-corr', anomalies);
    expect(correlation).not.toBeNull();
    expect(correlation?.affectedServices.length).toBe(2);
  });
});


// ============================================================================
// N309 서비스 의존성 맵
// ============================================================================
describe('MTU-N309 서비스 의존성 맵', () => {
  it('FR-N309.1: 호출 관계 탐지', () => {
    const edges = discoverDependencies('tenant-n309', [
      { source: 'api-gw', target: 'auth-svc', protocol: 'http', latencyMs: 10, statusCode: 200, timestamp: '' },
      { source: 'api-gw', target: 'auth-svc', protocol: 'http', latencyMs: 15, statusCode: 200, timestamp: '' },
      { source: 'auth-svc', target: 'db', protocol: 'tcp', latencyMs: 5, statusCode: 200, timestamp: '' },
    ]);
    expect(edges.length).toBe(2);
    expect(edges.some(e => e.sourceService === 'api-gw' && e.targetService === 'auth-svc')).toBe(true);
  });

  it('FR-N309.2: 토폴로지 맵 생성', () => {
    const nodes = [
      { serviceId: 's1', name: 'api-gw', version: '1.0', status: 'healthy' as const, endpoints: ['/api'], metadata: {} },
    ];
    const edges = discoverDependencies('tenant-n309-m', [
      { source: 'api-gw', target: 'db', protocol: 'tcp', latencyMs: 5, statusCode: 200, timestamp: '' },
    ]);
    const map = generateTopologyMap('tenant-n309-m', nodes, edges);
    expect(map.nodes.length).toBe(1);
    expect(map.edges.length).toBe(1);
  });

  it('FR-N309.3: 순환 의존성 탐지', () => {
    const edges = [
      { edgeId: 'e1', sourceService: 'A', targetService: 'B', protocol: 'http' as const, callsPerMinute: 10, avgLatencyMs: 5, errorRate: 0, criticality: 'medium' as const },
      { edgeId: 'e2', sourceService: 'B', targetService: 'C', protocol: 'http' as const, callsPerMinute: 10, avgLatencyMs: 5, errorRate: 0, criticality: 'medium' as const },
      { edgeId: 'e3', sourceService: 'C', targetService: 'A', protocol: 'http' as const, callsPerMinute: 10, avgLatencyMs: 5, errorRate: 0, criticality: 'medium' as const },
    ];
    const cycles = detectCircularDependencies(edges);
    expect(cycles.length).toBeGreaterThanOrEqual(1);
    expect(cycles[0]?.services.length).toBeGreaterThanOrEqual(3);
  });

  it('FR-N309.4: blast radius 분석', () => {
    const edges = [
      { edgeId: 'e1', sourceService: 'web', targetService: 'api', protocol: 'http' as const, callsPerMinute: 100, avgLatencyMs: 10, errorRate: 0, criticality: 'critical' as const },
      { edgeId: 'e2', sourceService: 'mobile', targetService: 'api', protocol: 'http' as const, callsPerMinute: 50, avgLatencyMs: 10, errorRate: 0, criticality: 'high' as const },
    ];
    const analysis = analyzeBlastRadius('tenant-n309-br', 'api', edges);
    expect(analysis.directlyAffected.length).toBe(2);
    expect(analysis.riskLevel).toBeDefined();
  });

  it('FR-N309.5: 변경 탐지', () => {
    const prev = [{ edgeId: 'e1', sourceService: 'A', targetService: 'B', protocol: 'http' as const, callsPerMinute: 10, avgLatencyMs: 5, errorRate: 0, criticality: 'low' as const }];
    const curr = [{ edgeId: 'e2', sourceService: 'A', targetService: 'C', protocol: 'grpc' as const, callsPerMinute: 20, avgLatencyMs: 3, errorRate: 0, criticality: 'medium' as const }];
    const changes = detectDependencyChanges('tenant-n309-ch', prev, curr);
    expect(changes.length).toBe(2); // 1 removed + 1 added
  });
});


// ============================================================================
// N310 카나리 분석
// ============================================================================
describe('MTU-N310 카나리 배포 분석', () => {
  it('FR-N310.1: 카나리 설정 생성', () => {
    const config = createCanaryConfig('tenant-n310', 'api-service', 'v1.0', 'v1.1');
    expect(config.canaryPercentage).toBe(10);
    expect(config.autoRollback).toBe(true);
  });

  it('FR-N310.2: 메트릭 비교', () => {
    const baseline: MetricSnapshot = {
      version: 'baseline', metrics: { error_rate: 1, p99_latency: 200, throughput: 1000 }, sampleSize: 1000, collectedAt: '',
    };
    const canary: MetricSnapshot = {
      version: 'canary', metrics: { error_rate: 1.5, p99_latency: 220, throughput: 980 }, sampleSize: 100, collectedAt: '',
    };
    const comparisons = compareMetrics(baseline, canary, ['error_rate', 'p99_latency', 'throughput']);
    expect(comparisons.length).toBe(3);
    expect(comparisons[0]?.changePercent).toBeDefined();
  });

  it('FR-N310.4: go/no-go 판단 (정상)', () => {
    const config = createCanaryConfig('tenant-n310-g', 'svc', 'v1', 'v2');
    const baseline: MetricSnapshot = {
      version: 'baseline', metrics: { error_rate: 1, p99_latency: 200, throughput: 1000, cpu_usage: 50 }, sampleSize: 1000, collectedAt: '',
    };
    const canary: MetricSnapshot = {
      version: 'canary', metrics: { error_rate: 1, p99_latency: 195, throughput: 1010, cpu_usage: 48 }, sampleSize: 500, collectedAt: '',
    };
    const analysis = makeCanaryDecision('tenant-n310-g', config, baseline, canary);
    expect(analysis.overallScore).toBeGreaterThan(50);
  });

  it('FR-N310.4: go/no-go 판단 (SLO 위반 -> 롤백)', () => {
    const config = createCanaryConfig('tenant-n310-r', 'svc', 'v1', 'v2');
    const baseline: MetricSnapshot = {
      version: 'baseline', metrics: { error_rate: 1, p99_latency: 200, throughput: 1000, cpu_usage: 50 }, sampleSize: 1000, collectedAt: '',
    };
    const canary: MetricSnapshot = {
      version: 'canary', metrics: { error_rate: 10, p99_latency: 500, throughput: 400, cpu_usage: 90 }, sampleSize: 500, collectedAt: '',
    };
    const analysis = makeCanaryDecision('tenant-n310-r', config, baseline, canary);
    expect(analysis.decision).toBe('rollback');
    expect(analysis.sloViolations.length).toBeGreaterThan(0);
  });

  it('FR-N310.5: 자동 롤백', () => {
    const rollback = executeRollback('tenant-n310', 'config-001', 'SLO 위반');
    expect(rollback.triggerType).toBe('auto');
    expect(rollback.rollbackTime).toBeGreaterThan(0);
  });
});
