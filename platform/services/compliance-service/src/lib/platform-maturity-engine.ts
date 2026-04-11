/**
 * 플랫폼 성숙도 평가 엔진
 * Design Ref: docs/02-design/mtus/MTU-N243-platform-maturity-assessment.design.md
 * Plan SC: FR-PM.1~FR-PM.5
 *
 * CNCF 플랫폼 성숙도 모델 기반 5영역 × 5단계 자동 평가
 * CI/CD, 관측성, 보안, 인프라, 거버넌스 영역
 * CSAP D-06 감사 로깅 연동
 */

/** 성숙도 수준 (L1~L5) */
export enum MaturityLevel {
  /** L1: 초기 — 수동 프로세스, 표준 부재 */
  Initial = 1,
  /** L2: 관리 — 기본 자동화, 부분 표준 */
  Managed = 2,
  /** L3: 정의 — 전사 표준, 체계적 프로세스 */
  Defined = 3,
  /** L4: 측정 — 메트릭 기반 의사결정, SLO 관리 */
  Measured = 4,
  /** L5: 최적화 — 자동 개선, 예측 기반 운영 */
  Optimizing = 5,
}

/** 평가 영역 */
export enum MaturityDomain {
  /** CI/CD 파이프라인 */
  CICD = 'CICD',
  /** 관측성 (Observability) */
  Observability = 'OBSERVABILITY',
  /** 보안 컴플라이언스 */
  Security = 'SECURITY',
  /** 인프라 자동화 */
  Infrastructure = 'INFRASTRUCTURE',
  /** 거버넌스 */
  Governance = 'GOVERNANCE',
}

/** 평가 항목 */
export interface AssessmentItem {
  /** 항목 ID */
  id: string;
  /** 영역 */
  domain: MaturityDomain;
  /** 항목 이름 */
  name: string;
  /** 설명 */
  description: string;
  /** 현재 충족 여부 */
  satisfied: boolean;
  /** 해당 수준 (이 항목이 충족되면 해당 수준 달성에 기여) */
  level: MaturityLevel;
  /** 증거 (충족 시 근거) */
  evidence?: string;
}

/** 영역별 평가 결과 */
export interface DomainAssessment {
  /** 영역 */
  domain: MaturityDomain;
  /** 영역 이름 (한글) */
  domainName: string;
  /** 달성 수준 */
  achievedLevel: MaturityLevel;
  /** 달성 수준 이름 */
  levelName: string;
  /** 총 항목 수 */
  totalItems: number;
  /** 충족 항목 수 */
  satisfiedItems: number;
  /** 충족률 (0.0~1.0) */
  satisfactionRate: number;
  /** 수준별 충족 현황 */
  levelBreakdown: Record<number, { total: number; satisfied: number }>;
  /** 미충족 항목 */
  gaps: AssessmentItem[];
}

/** 종합 평가 결과 */
export interface MaturityReport {
  /** 보고서 ID */
  reportId: string;
  /** 종합 점수 (1.0~5.0) */
  overallScore: number;
  /** 종합 수준 */
  overallLevel: MaturityLevel;
  /** 종합 수준 이름 */
  overallLevelName: string;
  /** 영역별 결과 */
  domains: DomainAssessment[];
  /** 개선 권장사항 */
  recommendations: Recommendation[];
  /** 평가 시각 */
  assessedAt: string;
  /** 총 항목 수 */
  totalItems: number;
  /** 총 충족 수 */
  totalSatisfied: number;
}

/** 개선 권장사항 */
export interface Recommendation {
  /** 우선순위 (1=최고) */
  priority: number;
  /** 대상 영역 */
  domain: MaturityDomain;
  /** 현재 수준 */
  currentLevel: MaturityLevel;
  /** 목표 수준 */
  targetLevel: MaturityLevel;
  /** 권장 조치 */
  action: string;
  /** 예상 효과 */
  impact: string;
  /** 난이도 */
  difficulty: 'low' | 'medium' | 'high';
}

/** 수준 이름 매핑 */
const LEVEL_NAMES: Record<number, string> = {
  1: 'Initial (초기)',
  2: 'Managed (관리)',
  3: 'Defined (정의)',
  4: 'Measured (측정)',
  5: 'Optimizing (최적화)',
};

/** 영역 이름 매핑 */
const DOMAIN_NAMES: Record<MaturityDomain, string> = {
  [MaturityDomain.CICD]: 'CI/CD 파이프라인',
  [MaturityDomain.Observability]: '관측성',
  [MaturityDomain.Security]: '보안 컴플라이언스',
  [MaturityDomain.Infrastructure]: '인프라 자동화',
  [MaturityDomain.Governance]: '거버넌스',
};

/** 기본 평가 항목 — Design Ref: 영역별 평가 기준 */
function createDefaultItems(): AssessmentItem[] {
  return [
    // === CI/CD 파이프라인 (10항목) ===
    { id: 'CICD-L1-01', domain: MaturityDomain.CICD, level: MaturityLevel.Initial,
      name: '소스코드 버전 관리', description: 'Git 기반 버전 관리 사용',
      satisfied: false },
    { id: 'CICD-L1-02', domain: MaturityDomain.CICD, level: MaturityLevel.Initial,
      name: '빌드 자동화', description: '수동 빌드 대신 자동 빌드 스크립트 존재',
      satisfied: false },
    { id: 'CICD-L2-01', domain: MaturityDomain.CICD, level: MaturityLevel.Managed,
      name: 'CI 파이프라인', description: 'PR/커밋 시 자동 빌드+테스트 실행',
      satisfied: false },
    { id: 'CICD-L2-02', domain: MaturityDomain.CICD, level: MaturityLevel.Managed,
      name: '자동 테스트', description: '단위 테스트 자동 실행',
      satisfied: false },
    { id: 'CICD-L3-01', domain: MaturityDomain.CICD, level: MaturityLevel.Defined,
      name: 'CD 파이프라인', description: '스테이징/프로덕션 자동 배포',
      satisfied: false },
    { id: 'CICD-L3-02', domain: MaturityDomain.CICD, level: MaturityLevel.Defined,
      name: 'DevSecOps 통합', description: 'SAST/DAST 보안 스캔 파이프라인 내장',
      satisfied: false },
    { id: 'CICD-L4-01', domain: MaturityDomain.CICD, level: MaturityLevel.Measured,
      name: 'DORA 메트릭 측정', description: 'DORA Four Keys 자동 수집+대시보드',
      satisfied: false },
    { id: 'CICD-L4-02', domain: MaturityDomain.CICD, level: MaturityLevel.Measured,
      name: '품질 게이트', description: 'Q-Gate 기반 자동 배포 차단',
      satisfied: false },
    { id: 'CICD-L5-01', domain: MaturityDomain.CICD, level: MaturityLevel.Optimizing,
      name: '캐시 최적화', description: 'BuildKit 캐시 히트율 모니터링+GC 자동화',
      satisfied: false },
    { id: 'CICD-L5-02', domain: MaturityDomain.CICD, level: MaturityLevel.Optimizing,
      name: '자동 롤백', description: 'SLO 위반 시 자동 롤백 + 에러 예산 관리',
      satisfied: false },

    // === 관측성 (10항목) ===
    { id: 'OBS-L1-01', domain: MaturityDomain.Observability, level: MaturityLevel.Initial,
      name: '기본 로깅', description: '애플리케이션 로그 수집',
      satisfied: false },
    { id: 'OBS-L1-02', domain: MaturityDomain.Observability, level: MaturityLevel.Initial,
      name: '기본 메트릭', description: 'CPU/메모리 기본 메트릭 수집',
      satisfied: false },
    { id: 'OBS-L2-01', domain: MaturityDomain.Observability, level: MaturityLevel.Managed,
      name: '구조화 로깅', description: 'JSON 구조화 로그 + 중앙 수집',
      satisfied: false },
    { id: 'OBS-L2-02', domain: MaturityDomain.Observability, level: MaturityLevel.Managed,
      name: '알림 설정', description: 'Prometheus 알림 규칙 설정',
      satisfied: false },
    { id: 'OBS-L3-01', domain: MaturityDomain.Observability, level: MaturityLevel.Defined,
      name: '분산 추적', description: 'OpenTelemetry 분산 추적 구현',
      satisfied: false },
    { id: 'OBS-L3-02', domain: MaturityDomain.Observability, level: MaturityLevel.Defined,
      name: 'SLO/SLI 정의', description: 'SLO 정의 + SLI 자동 수집',
      satisfied: false },
    { id: 'OBS-L4-01', domain: MaturityDomain.Observability, level: MaturityLevel.Measured,
      name: '에러 예산 관리', description: 'SRE 에러 예산 정책 운영',
      satisfied: false },
    { id: 'OBS-L4-02', domain: MaturityDomain.Observability, level: MaturityLevel.Measured,
      name: '이상 탐지', description: '메트릭 이상 탐지 자동화',
      satisfied: false },
    { id: 'OBS-L5-01', domain: MaturityDomain.Observability, level: MaturityLevel.Optimizing,
      name: '예측 알림', description: 'predict_linear 기반 예측 알림',
      satisfied: false },
    { id: 'OBS-L5-02', domain: MaturityDomain.Observability, level: MaturityLevel.Optimizing,
      name: 'AIOps RCA', description: 'AI 기반 자동 근본 원인 분석',
      satisfied: false },

    // === 보안 컴플라이언스 (10항목) ===
    { id: 'SEC-L1-01', domain: MaturityDomain.Security, level: MaturityLevel.Initial,
      name: '기본 인증', description: '사용자 인증 구현',
      satisfied: false },
    { id: 'SEC-L1-02', domain: MaturityDomain.Security, level: MaturityLevel.Initial,
      name: '기본 권한', description: '역할 기반 접근 통제(RBAC)',
      satisfied: false },
    { id: 'SEC-L2-01', domain: MaturityDomain.Security, level: MaturityLevel.Managed,
      name: '감사 로깅', description: '민감 작업 감사 로그 기록',
      satisfied: false },
    { id: 'SEC-L2-02', domain: MaturityDomain.Security, level: MaturityLevel.Managed,
      name: '입력 검증', description: 'Zod 스키마 기반 입력 검증',
      satisfied: false },
    { id: 'SEC-L3-01', domain: MaturityDomain.Security, level: MaturityLevel.Defined,
      name: 'CSAP 통제', description: 'CSAP 79개 통제항목 매핑+증적',
      satisfied: false },
    { id: 'SEC-L3-02', domain: MaturityDomain.Security, level: MaturityLevel.Defined,
      name: 'N2SF 분류', description: 'N2SF 데이터 등급 분류 체계',
      satisfied: false },
    { id: 'SEC-L4-01', domain: MaturityDomain.Security, level: MaturityLevel.Measured,
      name: '취약점 스캔', description: 'Trivy 취약점 스캔 자동화+추적',
      satisfied: false },
    { id: 'SEC-L4-02', domain: MaturityDomain.Security, level: MaturityLevel.Measured,
      name: 'SBOM 관리', description: '소프트웨어 BOM 자동 생성+서명',
      satisfied: false },
    { id: 'SEC-L5-01', domain: MaturityDomain.Security, level: MaturityLevel.Optimizing,
      name: '공급망 보안', description: 'Cosign 이미지 서명+Kyverno 검증',
      satisfied: false },
    { id: 'SEC-L5-02', domain: MaturityDomain.Security, level: MaturityLevel.Optimizing,
      name: '보안 자동화', description: 'OPA/Kyverno Policy as Code 운영',
      satisfied: false },

    // === 인프라 자동화 (10항목) ===
    { id: 'INFRA-L1-01', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Initial,
      name: '컨테이너화', description: 'Docker 컨테이너 기반 배포',
      satisfied: false },
    { id: 'INFRA-L1-02', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Initial,
      name: '오케스트레이션', description: 'k3s/k8s 기반 오케스트레이션',
      satisfied: false },
    { id: 'INFRA-L2-01', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Managed,
      name: 'IaC 기본', description: 'Helm/Kustomize 기반 선언적 관리',
      satisfied: false },
    { id: 'INFRA-L2-02', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Managed,
      name: '네트워크 정책', description: 'NetworkPolicy 기반 트래픽 제어',
      satisfied: false },
    { id: 'INFRA-L3-01', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Defined,
      name: 'GitOps', description: 'ArgoCD/Flux 기반 GitOps 운영',
      satisfied: false },
    { id: 'INFRA-L3-02', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Defined,
      name: '멀티테넌시', description: '네임스페이스 기반 테넌트 격리',
      satisfied: false },
    { id: 'INFRA-L4-01', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Measured,
      name: '리소스 최적화', description: 'VPA/HPA 기반 자동 스케일링',
      satisfied: false },
    { id: 'INFRA-L4-02', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Measured,
      name: '재해 복구', description: 'DR 자동화 + RTO/RPO 측정',
      satisfied: false },
    { id: 'INFRA-L5-01', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Optimizing,
      name: '자가 치유', description: '자동 장애 감지+복구(self-healing)',
      satisfied: false },
    { id: 'INFRA-L5-02', domain: MaturityDomain.Infrastructure, level: MaturityLevel.Optimizing,
      name: '예측 스케일링', description: '트래픽 예측 기반 사전 스케일링',
      satisfied: false },

    // === 거버넌스 (10항목) ===
    { id: 'GOV-L1-01', domain: MaturityDomain.Governance, level: MaturityLevel.Initial,
      name: '기본 문서화', description: '프로젝트 기본 문서(README 등)',
      satisfied: false },
    { id: 'GOV-L1-02', domain: MaturityDomain.Governance, level: MaturityLevel.Initial,
      name: '이슈 추적', description: '이슈/태스크 추적 시스템 사용',
      satisfied: false },
    { id: 'GOV-L2-01', domain: MaturityDomain.Governance, level: MaturityLevel.Managed,
      name: 'PDCA 프로세스', description: 'Plan-Do-Check-Act 문서 체계',
      satisfied: false },
    { id: 'GOV-L2-02', domain: MaturityDomain.Governance, level: MaturityLevel.Managed,
      name: '변경 관리', description: 'Git 기반 변경 이력 관리',
      satisfied: false },
    { id: 'GOV-L3-01', domain: MaturityDomain.Governance, level: MaturityLevel.Defined,
      name: '감리 기준', description: '행안부 감리기준 문서 형식 준수',
      satisfied: false },
    { id: 'GOV-L3-02', domain: MaturityDomain.Governance, level: MaturityLevel.Defined,
      name: '추적성 매트릭스', description: 'FR↔산출물↔테스트↔CSAP 추적성',
      satisfied: false },
    { id: 'GOV-L4-01', domain: MaturityDomain.Governance, level: MaturityLevel.Measured,
      name: '자동 보고서', description: '성숙도/진행률 자동 보고서 생성',
      satisfied: false },
    { id: 'GOV-L4-02', domain: MaturityDomain.Governance, level: MaturityLevel.Measured,
      name: '증적 자동화', description: 'CSAP 증적 자동 수집+무결성 검증',
      satisfied: false },
    { id: 'GOV-L5-01', domain: MaturityDomain.Governance, level: MaturityLevel.Optimizing,
      name: '성숙도 추적', description: '성숙도 자동 평가+추적 시스템',
      satisfied: false },
    { id: 'GOV-L5-02', domain: MaturityDomain.Governance, level: MaturityLevel.Optimizing,
      name: '지속 개선', description: '자동 개선 권장사항 생성+로드맵 관리',
      satisfied: false },
  ];
}

export class PlatformMaturityEngine {
  private items: AssessmentItem[];
  private readonly reportHistory: MaturityReport[] = [];
  private readonly maxHistory: number;

  constructor(options?: {
    items?: AssessmentItem[];
    maxHistory?: number;
  }) {
    this.items = options?.items ?? createDefaultItems();
    this.maxHistory = options?.maxHistory ?? 100;
  }

  /**
   * 항목 충족 표시
   * Design Ref: FR-PM.1 — 자동 점검
   */
  markSatisfied(itemId: string, evidence?: string): boolean {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return false;

    item.satisfied = true;
    if (evidence) {
      item.evidence = evidence;
    }
    return true;
  }

  /**
   * 항목 미충족 표시
   */
  markUnsatisfied(itemId: string): boolean {
    const item = this.items.find(i => i.id === itemId);
    if (!item) return false;

    item.satisfied = false;
    item.evidence = undefined;
    return true;
  }

  /**
   * 일괄 충족 표시
   */
  markMultipleSatisfied(itemIds: string[], evidence?: string): number {
    let count = 0;
    for (const id of itemIds) {
      if (this.markSatisfied(id, evidence)) {
        count++;
      }
    }
    return count;
  }

  /**
   * 영역별 성숙도 평가
   * Design Ref: FR-PM.2 — 5단계 점수 산출
   *
   * 달성 수준 결정 규칙:
   * - 해당 수준의 모든 항목이 충족되어야 해당 수준 달성
   * - 하위 수준이 미달성이면 상위 수준도 미달성
   */
  assessDomain(domain: MaturityDomain): DomainAssessment {
    const domainItems = this.items.filter(i => i.domain === domain);
    const satisfiedItems = domainItems.filter(i => i.satisfied);

    // 수준별 충족 현황
    const levelBreakdown: Record<number, { total: number; satisfied: number }> = {};
    for (let level = 1; level <= 5; level++) {
      const levelItems = domainItems.filter(i => i.level === level);
      const levelSatisfied = levelItems.filter(i => i.satisfied);
      levelBreakdown[level] = {
        total: levelItems.length,
        satisfied: levelSatisfied.length,
      };
    }

    // 달성 수준 결정: 연속된 수준에서 모든 항목 충족
    let achievedLevel = MaturityLevel.Initial;
    for (let level = 1; level <= 5; level++) {
      const breakdown = levelBreakdown[level]!;
      if (breakdown.total > 0 && breakdown.satisfied >= breakdown.total) {
        achievedLevel = level as MaturityLevel;
      } else {
        break; // 하위 수준 미달성 시 중단
      }
    }

    // 미충족 항목 (갭)
    const gaps = domainItems.filter(i => !i.satisfied);

    const totalItems = domainItems.length;
    const satisfiedCount = satisfiedItems.length;
    const satisfactionRate = totalItems > 0
      ? Math.round((satisfiedCount / totalItems) * 10000) / 10000
      : 0;

    return {
      domain,
      domainName: DOMAIN_NAMES[domain],
      achievedLevel,
      levelName: LEVEL_NAMES[achievedLevel] ?? 'Unknown',
      totalItems,
      satisfiedItems: satisfiedCount,
      satisfactionRate,
      levelBreakdown,
      gaps,
    };
  }

  /**
   * 종합 성숙도 보고서 생성
   * Design Ref: FR-PM.3 — 종합 성숙도 보고서
   */
  generateReport(): MaturityReport {
    const domains = Object.values(MaturityDomain).map(d => this.assessDomain(d));

    // 종합 점수: 영역별 달성 수준의 평균
    const totalScore = domains.reduce((sum, d) => sum + d.achievedLevel, 0) / domains.length;
    const overallScore = Math.round(totalScore * 100) / 100;
    const overallLevel = Math.floor(totalScore) as MaturityLevel;

    // 개선 권장사항 생성
    const recommendations = this.generateRecommendations(domains);

    const totalItems = domains.reduce((sum, d) => sum + d.totalItems, 0);
    const totalSatisfied = domains.reduce((sum, d) => sum + d.satisfiedItems, 0);

    const report: MaturityReport = {
      reportId: `maturity-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      overallScore,
      overallLevel,
      overallLevelName: LEVEL_NAMES[overallLevel] ?? 'Unknown',
      domains,
      recommendations,
      assessedAt: new Date().toISOString(),
      totalItems,
      totalSatisfied,
    };

    // 보고서 이력 저장
    this.reportHistory.push(report);
    if (this.reportHistory.length > this.maxHistory) {
      this.reportHistory.splice(0, this.reportHistory.length - this.maxHistory);
    }

    return report;
  }

  /**
   * 개선 권장사항 자동 생성
   * Design Ref: FR-PM.4 — 개선 권장사항 자동 제시
   */
  private generateRecommendations(domains: DomainAssessment[]): Recommendation[] {
    const recommendations: Recommendation[] = [];
    let priority = 1;

    // 가장 낮은 수준의 영역부터 우선 개선
    const sorted = [...domains].sort((a, b) => a.achievedLevel - b.achievedLevel);

    for (const domain of sorted) {
      if (domain.achievedLevel >= MaturityLevel.Optimizing) continue;

      const targetLevel = (domain.achievedLevel + 1) as MaturityLevel;
      const targetLevelName = LEVEL_NAMES[targetLevel] ?? 'Unknown';
      const gapsAtTarget = domain.gaps.filter(g => g.level === targetLevel);

      if (gapsAtTarget.length === 0) continue;

      const gapNames = gapsAtTarget.map(g => g.name).join(', ');
      const difficulty = targetLevel <= 2 ? 'low' as const
        : targetLevel <= 4 ? 'medium' as const
        : 'high' as const;

      recommendations.push({
        priority: priority++,
        domain: domain.domain,
        currentLevel: domain.achievedLevel,
        targetLevel,
        action: `${domain.domainName} 영역을 ${targetLevelName} 수준으로 향상: ${gapNames} 구현 필요`,
        impact: `${domain.domainName} 성숙도 ${domain.achievedLevel} → ${targetLevel} 향상`,
        difficulty,
      });
    }

    return recommendations;
  }

  /**
   * 마크다운 보고서 생성
   * Design Ref: FR-PM.3
   */
  generateMarkdownReport(): string {
    const report = this.generateReport();
    const lines: string[] = [];

    lines.push('# 플랫폼 성숙도 평가 보고서');
    lines.push('');
    lines.push(`> 평가 시각: ${report.assessedAt}`);
    lines.push(`> 보고서 ID: ${report.reportId}`);
    lines.push('');

    lines.push('## 종합 결과');
    lines.push('');
    lines.push(`| 항목 | 값 |`);
    lines.push(`|------|-----|`);
    lines.push(`| 종합 점수 | ${report.overallScore} / 5.0 |`);
    lines.push(`| 종합 수준 | ${report.overallLevelName} |`);
    lines.push(`| 총 항목 | ${report.totalItems} |`);
    lines.push(`| 충족 항목 | ${report.totalSatisfied} |`);
    lines.push(`| 충족률 | ${Math.round((report.totalSatisfied / report.totalItems) * 100)}% |`);
    lines.push('');

    lines.push('## 영역별 결과');
    lines.push('');
    lines.push('| 영역 | 수준 | 점수 | 충족률 |');
    lines.push('|------|------|------|--------|');
    for (const domain of report.domains) {
      const rate = Math.round(domain.satisfactionRate * 100);
      lines.push(`| ${domain.domainName} | ${domain.levelName} | ${domain.achievedLevel}/5 | ${rate}% |`);
    }
    lines.push('');

    if (report.recommendations.length > 0) {
      lines.push('## 개선 권장사항');
      lines.push('');
      for (const rec of report.recommendations) {
        lines.push(`### ${rec.priority}. ${DOMAIN_NAMES[rec.domain]}`);
        lines.push('');
        lines.push(`- **현재**: ${LEVEL_NAMES[rec.currentLevel]}`);
        lines.push(`- **목표**: ${LEVEL_NAMES[rec.targetLevel]}`);
        lines.push(`- **조치**: ${rec.action}`);
        lines.push(`- **효과**: ${rec.impact}`);
        lines.push(`- **난이도**: ${rec.difficulty}`);
        lines.push('');
      }
    }

    return lines.join('\n');
  }

  /**
   * 평가 항목 전체 조회
   */
  getItems(): AssessmentItem[] {
    return [...this.items];
  }

  /**
   * 영역별 항목 조회
   */
  getItemsByDomain(domain: MaturityDomain): AssessmentItem[] {
    return this.items.filter(i => i.domain === domain);
  }

  /**
   * 보고서 이력 조회
   */
  getReportHistory(limit: number = 10): MaturityReport[] {
    return this.reportHistory.slice(-limit);
  }

  /**
   * 전체 항목 수
   */
  getTotalItemCount(): number {
    return this.items.length;
  }

  /**
   * 충족 항목 수
   */
  getSatisfiedCount(): number {
    return this.items.filter(i => i.satisfied).length;
  }
}
