/**
 * AIOps 자동 근본 원인 분석 (RCA) 엔진
 * Design Ref: docs/02-design/mtus/MTU-N252-aiops-rca.design.md §2.2
 * Plan SC: FR-N252.1, FR-N252.2, FR-N252.4, FR-N252.5
 *
 * 증상→원인 패턴 매칭 기반 자동 RCA 수행
 * CSAP D-06 침해사고 관리 준수
 */

/** 메트릭 이상 유형 */
export enum AnomalyType {
  HighCPU = 'high_cpu',
  HighMemory = 'high_memory',
  OOMKill = 'oom_kill',
  HighLatency = 'high_latency',
  HighErrorRate = 'high_error_rate',
  DiskIOHigh = 'disk_io_high',
  NetworkError = 'network_error',
  PodRestart = 'pod_restart',
  CrashLoop = 'crash_loop',
  NodeNotReady = 'node_not_ready',
  PodPending = 'pod_pending',
  PVCPending = 'pvc_pending',
  DNSLatency = 'dns_latency',
  RecentDeploy = 'recent_deploy',
  NormalResources = 'normal_resources',
}

/** 인시던트 심각도 */
export enum IncidentSeverity {
  Critical = 'critical',
  High = 'high',
  Medium = 'medium',
  Low = 'low',
}

/** RCA 후보 */
export interface RCACandidate {
  /** 근본 원인 설명 */
  cause: string;
  /** 확률 (0.0 ~ 1.0) */
  confidence: number;
  /** 매칭된 증상 패턴 */
  matchedSymptoms: AnomalyType[];
  /** 권고 조치 */
  recommendation: string;
  /** 패턴 ID */
  patternId: number;
  /** 카테고리 */
  category: RCACategory;
}

/** RCA 카테고리 */
export enum RCACategory {
  Resource = 'resource',
  Application = 'application',
  Infrastructure = 'infrastructure',
  Network = 'network',
  Storage = 'storage',
  Dependency = 'dependency',
}

/** 인시던트 정보 */
export interface Incident {
  /** 인시던트 ID */
  id: string;
  /** 서비스 이름 */
  service: string;
  /** 네임스페이스 */
  namespace: string;
  /** 감지된 이상 징후 목록 */
  symptoms: AnomalyType[];
  /** 심각도 */
  severity: IncidentSeverity;
  /** 시작 시각 */
  startedAt: string;
  /** 추가 컨텍스트 */
  context?: Record<string, string | number>;
}

/** RCA 분석 결과 */
export interface RCAResult {
  /** 인시던트 정보 */
  incident: Incident;
  /** RCA 후보 목록 (확률 순) */
  candidates: RCACandidate[];
  /** 분석 시각 */
  analyzedAt: string;
  /** 상관관계 점수 */
  correlationScores: CorrelationScore[];
  /** 분석 소요 시간 (ms) */
  analysisTimeMs: number;
}

/** 상관관계 점수 */
export interface CorrelationScore {
  /** 메트릭 A */
  metricA: string;
  /** 메트릭 B */
  metricB: string;
  /** 상관계수 (-1.0 ~ 1.0) */
  correlation: number;
}

/** RCA 보고서 */
export interface RCAReport {
  /** 문서 ID */
  documentId: string;
  /** 생성일 */
  generatedAt: string;
  /** CSAP 참조 */
  csapRef: string[];
  /** 보고서 본문 (Markdown) */
  content: string;
}

/** RCA 패턴 정의 */
interface RCAPattern {
  id: number;
  symptoms: AnomalyType[];
  cause: string;
  confidence: number;
  recommendation: string;
  category: RCACategory;
}

/**
 * RCA 패턴 정의 (10개+ 증상→원인 매핑)
 * Design Ref: §2.2 — RCA 패턴 매핑 규칙
 */
const RCA_PATTERNS: RCAPattern[] = [
  {
    id: 1,
    symptoms: [AnomalyType.HighCPU, AnomalyType.HighLatency],
    cause: 'CPU 병목 — 컴퓨팅 리소스 부족으로 요청 처리 지연',
    confidence: 0.85,
    recommendation: '수평 확장(HPA) 임계값 조정 또는 리소스 Limits 증가. CPU 프로파일링 실행.',
    category: RCACategory.Resource,
  },
  {
    id: 2,
    symptoms: [AnomalyType.OOMKill, AnomalyType.HighMemory],
    cause: '메모리 누수 — OOM Kill 발생으로 서비스 재시작',
    confidence: 0.90,
    recommendation: '메모리 프로파일링 실행. 리소스 Limits 상향 후 누수 코드 수정.',
    category: RCACategory.Application,
  },
  {
    id: 3,
    symptoms: [AnomalyType.HighErrorRate, AnomalyType.NormalResources],
    cause: '업스트림 의존성 장애 — 리소스 정상이나 외부 서비스 응답 실패',
    confidence: 0.80,
    recommendation: '업스트림 서비스 상태 확인. Circuit Breaker 설정 검토.',
    category: RCACategory.Dependency,
  },
  {
    id: 4,
    symptoms: [AnomalyType.DiskIOHigh, AnomalyType.HighLatency],
    cause: '디스크 I/O 병목 — 스토리지 성능 저하로 지연 증가',
    confidence: 0.82,
    recommendation: 'PV 유형 확인 (SSD 전환). 쿼리 최적화 또는 캐시 레이어 도입.',
    category: RCACategory.Storage,
  },
  {
    id: 5,
    symptoms: [AnomalyType.NetworkError, AnomalyType.HighLatency],
    cause: '네트워크 문제 — 패킷 손실 또는 DNS 해석 지연',
    confidence: 0.78,
    recommendation: 'MTU 설정 확인. NetworkPolicy 검토. CoreDNS 로그 분석.',
    category: RCACategory.Network,
  },
  {
    id: 6,
    symptoms: [AnomalyType.PodRestart, AnomalyType.CrashLoop],
    cause: '애플리케이션 크래시 — 코드 버그 또는 설정 오류로 반복 재시작',
    confidence: 0.92,
    recommendation: '최근 배포 롤백. 파드 로그 분석. 초기화 실패 여부 확인.',
    category: RCACategory.Application,
  },
  {
    id: 7,
    symptoms: [AnomalyType.NodeNotReady, AnomalyType.PodPending],
    cause: '노드 장애 — 워커 노드 비정상으로 파드 스케줄링 불가',
    confidence: 0.88,
    recommendation: '노드 상태 확인 (kubectl get nodes). 노드 교체 또는 재시작.',
    category: RCACategory.Infrastructure,
  },
  {
    id: 8,
    symptoms: [AnomalyType.PVCPending, AnomalyType.PodPending],
    cause: '스토리지 부족 — PVC 바인딩 실패로 파드 시작 불가',
    confidence: 0.86,
    recommendation: 'StorageClass 확인. PV 용량 확장 또는 새 PV 프로비저닝.',
    category: RCACategory.Storage,
  },
  {
    id: 9,
    symptoms: [AnomalyType.HighErrorRate, AnomalyType.RecentDeploy],
    cause: '최근 배포 문제 — 새 버전 배포 후 에러율 급증',
    confidence: 0.91,
    recommendation: '즉시 롤백 실행. 배포된 변경사항 검토. 카나리/B-G 배포 전략 적용.',
    category: RCACategory.Application,
  },
  {
    id: 10,
    symptoms: [AnomalyType.DNSLatency, AnomalyType.HighLatency],
    cause: 'CoreDNS 병목 — DNS 해석 지연으로 전체 서비스 응답 시간 증가',
    confidence: 0.75,
    recommendation: 'CoreDNS 리소스 확장. DNS 캐시 TTL 조정. ndots 설정 최적화.',
    category: RCACategory.Network,
  },
  {
    id: 11,
    symptoms: [AnomalyType.HighMemory, AnomalyType.HighLatency],
    cause: '메모리 압박 — GC 빈도 증가로 지연 발생',
    confidence: 0.77,
    recommendation: '힙 메모리 프로파일링. GC 튜닝 또는 메모리 Limits 조정.',
    category: RCACategory.Resource,
  },
  {
    id: 12,
    symptoms: [AnomalyType.HighCPU, AnomalyType.PodRestart],
    cause: 'CPU 스로틀링 — CPU Limits 초과로 파드 성능 저하 및 재시작',
    confidence: 0.83,
    recommendation: 'CPU Limits 상향. Burstable QoS에서 Guaranteed로 전환 검토.',
    category: RCACategory.Resource,
  },
];

export class RCAEngine {
  private readonly patterns: RCAPattern[];
  private analysisHistory: RCAResult[] = [];
  private readonly maxHistory = 1000;

  constructor(customPatterns?: RCAPattern[]) {
    this.patterns = customPatterns || RCA_PATTERNS;
  }

  /**
   * 인시던트에 대한 RCA 분석 수행
   * Design Ref: §2.2 — 증상→원인 자동 매핑
   */
  analyze(incident: Incident): RCAResult {
    const startTime = Date.now();

    // 패턴 매칭
    const candidates = this.matchPatterns(incident.symptoms);

    // 상관관계 계산
    const correlationScores = this.calculateCorrelations(incident.symptoms);

    // 확률 순 정렬 (높은 확률 우선)
    candidates.sort((a, b) => b.confidence - a.confidence);

    const result: RCAResult = {
      incident,
      candidates,
      analyzedAt: new Date().toISOString(),
      correlationScores,
      analysisTimeMs: Date.now() - startTime,
    };

    // 히스토리 저장
    this.analysisHistory.push(result);
    if (this.analysisHistory.length > this.maxHistory) {
      this.analysisHistory = this.analysisHistory.slice(-this.maxHistory);
    }

    return result;
  }

  /**
   * RCA 결과를 알림 주석 텍스트로 변환
   * Design Ref: §2.5 — 알림 + RCA 후보 자동 주석
   */
  formatAlertAnnotation(result: RCAResult): string {
    if (result.candidates.length === 0) {
      return '[RCA] 자동 원인 분석: 매칭되는 패턴 없음. 수동 분석 필요.';
    }

    const top = result.candidates[0]!;
    const lines: string[] = [
      `[RCA] 자동 근본 원인 분석 (${result.analysisTimeMs}ms)`,
      `가장 유력한 원인: ${top.cause}`,
      `확률: ${(top.confidence * 100).toFixed(0)}%`,
      `카테고리: ${top.category}`,
      `권고 조치: ${top.recommendation}`,
    ];

    if (result.candidates.length > 1) {
      lines.push(`추가 후보: ${result.candidates.length - 1}개`);
    }

    return lines.join('\n');
  }

  /**
   * RCA 보고서 Markdown 생성
   * Design Ref: §2.4 — RCA 보고서 자동 생성
   */
  generateReport(result: RCAResult): RCAReport {
    const now = new Date();
    const sections: string[] = [];

    // 헤더
    sections.push('# AIOps RCA 분석 보고서');
    sections.push('');
    sections.push(`> **인시던트 ID**: ${result.incident.id}`);
    sections.push(`> **서비스**: ${result.incident.service}`);
    sections.push(`> **네임스페이스**: ${result.incident.namespace}`);
    sections.push(`> **심각도**: ${result.incident.severity}`);
    sections.push(`> **분석 시각**: ${result.analyzedAt}`);
    sections.push(`> **CSAP 참조**: D-06 침해사고 관리`);
    sections.push('');

    // 인시던트 타임라인
    sections.push('## 1. 인시던트 타임라인');
    sections.push('');
    sections.push(`| 시각 | 이벤트 |`);
    sections.push(`|------|--------|`);
    sections.push(`| ${result.incident.startedAt} | 인시던트 감지 |`);
    sections.push(`| ${result.analyzedAt} | RCA 분석 완료 (${result.analysisTimeMs}ms) |`);
    sections.push('');

    // 감지된 이상 징후
    sections.push('## 2. 감지된 이상 징후');
    sections.push('');
    for (const symptom of result.incident.symptoms) {
      sections.push(`- ${symptom}`);
    }
    sections.push('');

    // 상관관계 분석
    if (result.correlationScores.length > 0) {
      sections.push('## 3. 상관관계 분석');
      sections.push('');
      sections.push('| 메트릭 A | 메트릭 B | 상관계수 |');
      sections.push('|---------|---------|---------|');
      for (const score of result.correlationScores) {
        sections.push(`| ${score.metricA} | ${score.metricB} | ${score.correlation.toFixed(3)} |`);
      }
      sections.push('');
    }

    // RCA 후보
    sections.push(`## ${result.correlationScores.length > 0 ? '4' : '3'}. RCA 후보 (확률 순위)`);
    sections.push('');
    if (result.candidates.length === 0) {
      sections.push('매칭되는 패턴이 없습니다. 수동 분석이 필요합니다.');
    } else {
      sections.push('| 순위 | 원인 | 확률 | 카테고리 | 권고 조치 |');
      sections.push('|------|------|------|---------|----------|');
      result.candidates.forEach((candidate, index) => {
        sections.push(
          `| ${index + 1} | ${candidate.cause} | ${(candidate.confidence * 100).toFixed(0)}% | ${candidate.category} | ${candidate.recommendation} |`,
        );
      });
    }
    sections.push('');

    // 권고 조치 상세
    if (result.candidates.length > 0) {
      const sectionNum = result.correlationScores.length > 0 ? '5' : '4';
      sections.push(`## ${sectionNum}. 권고 조치 (즉시)`);
      sections.push('');
      const top = result.candidates[0]!;
      sections.push(`1. **${top.recommendation}**`);
      sections.push(`2. 모니터링 강화: 관련 메트릭 집중 모니터링 (5분 간격)`);
      sections.push(`3. 에스컬레이션: 30분 내 미해결 시 상위 레벨 에스컬레이션`);
      sections.push('');
    }

    // 푸터
    sections.push('---');
    sections.push(`*본 보고서는 AIOps RCA Engine에 의해 자동 생성되었습니다. (${now.toISOString()})*`);

    return {
      documentId: `RCA-${result.incident.id}-${now.getTime()}`,
      generatedAt: now.toISOString(),
      csapRef: ['D-06'],
      content: sections.join('\n'),
    };
  }

  /**
   * 분석 히스토리 조회
   */
  getHistory(limit: number = 50): RCAResult[] {
    return this.analysisHistory.slice(-limit);
  }

  /**
   * 패턴 수 반환
   */
  getPatternCount(): number {
    return this.patterns.length;
  }

  /**
   * 패턴 매칭: 인시던트 증상과 일치하는 RCA 패턴 검색
   */
  private matchPatterns(symptoms: AnomalyType[]): RCACandidate[] {
    const candidates: RCACandidate[] = [];
    const symptomSet = new Set(symptoms);

    for (const pattern of this.patterns) {
      // 패턴의 모든 증상이 인시던트 증상에 포함되는지 확인
      const matchedSymptoms = pattern.symptoms.filter(s => symptomSet.has(s));
      const matchRatio = matchedSymptoms.length / pattern.symptoms.length;

      if (matchRatio >= 0.5) {
        // 50% 이상 매칭 시 후보로 추가 (부분 매칭 허용)
        const adjustedConfidence = pattern.confidence * matchRatio;

        candidates.push({
          cause: pattern.cause,
          confidence: Math.round(adjustedConfidence * 100) / 100,
          matchedSymptoms: matchedSymptoms as AnomalyType[],
          recommendation: pattern.recommendation,
          patternId: pattern.id,
          category: pattern.category,
        });
      }
    }

    return candidates;
  }

  /**
   * 증상 간 상관관계 계산
   * Design Ref: §2.1 — 상관관계 Recording Rules
   */
  private calculateCorrelations(symptoms: AnomalyType[]): CorrelationScore[] {
    const scores: CorrelationScore[] = [];

    // 사전 정의된 상관관계 매핑
    const correlationMap: Record<string, number> = {
      [`${AnomalyType.HighCPU}:${AnomalyType.HighLatency}`]: 0.85,
      [`${AnomalyType.HighMemory}:${AnomalyType.OOMKill}`]: 0.95,
      [`${AnomalyType.HighMemory}:${AnomalyType.HighLatency}`]: 0.72,
      [`${AnomalyType.DiskIOHigh}:${AnomalyType.HighLatency}`]: 0.78,
      [`${AnomalyType.NetworkError}:${AnomalyType.HighLatency}`]: 0.82,
      [`${AnomalyType.PodRestart}:${AnomalyType.CrashLoop}`]: 0.98,
      [`${AnomalyType.NodeNotReady}:${AnomalyType.PodPending}`]: 0.92,
      [`${AnomalyType.PVCPending}:${AnomalyType.PodPending}`]: 0.88,
      [`${AnomalyType.DNSLatency}:${AnomalyType.HighLatency}`]: 0.76,
      [`${AnomalyType.HighErrorRate}:${AnomalyType.RecentDeploy}`]: 0.87,
      [`${AnomalyType.HighCPU}:${AnomalyType.PodRestart}`]: 0.65,
    };

    // 인시던트 증상 간의 상관관계만 추출
    for (let i = 0; i < symptoms.length; i++) {
      for (let j = i + 1; j < symptoms.length; j++) {
        const symptomA = symptoms[i]!;
        const symptomB = symptoms[j]!;
        const key = `${symptomA}:${symptomB}`;
        const reverseKey = `${symptomB}:${symptomA}`;
        const correlation = correlationMap[key] || correlationMap[reverseKey];

        if (correlation !== undefined) {
          scores.push({
            metricA: symptomA,
            metricB: symptomB,
            correlation,
          });
        }
      }
    }

    return scores.sort((a, b) => b.correlation - a.correlation);
  }
}
