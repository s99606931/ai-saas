/**
 * CSAP 증거 수집 자동화 v2
 * Design Ref: docs/02-design/mtus/MTU-N253-csap-evidence-v2.design.md
 * Plan SC: FR-N253.1, FR-N253.2, FR-N253.3
 *
 * CSAP 79개 통제항목 증거를 자동 수집하고 SHA256 무결성 검증
 * DORA/RCA/SLO 메트릭 증거 포함
 * CSAP D-06 침해사고 관리, D-01~D-13 전 영역 커버
 */

import { createHash } from 'crypto';

/** CSAP 통제 영역 */
export enum CSAPDomain {
  D01 = 'D-01', // 정보보호 정책
  D02 = 'D-02', // 정보보호 조직
  D03 = 'D-03', // 인적 보안
  D04 = 'D-04', // 자산 관리
  D05 = 'D-05', // 물리적 보안
  D06 = 'D-06', // 침해사고 관리
  D07 = 'D-07', // 보안 교육
  D08 = 'D-08', // 접근 통제
  D09 = 'D-09', // 암호화
  D10 = 'D-10', // 운영 관리
  D11 = 'D-11', // 네트워크 보안
  D12 = 'D-12', // 시스템 개발 보안
  D13 = 'D-13', // 서비스 연속성
}

/** 증거 유형 */
export enum EvidenceType {
  /** 정책 문서 */
  Policy = 'policy',
  /** 설정 파일 */
  Configuration = 'configuration',
  /** 로그 데이터 */
  Log = 'log',
  /** 메트릭 데이터 */
  Metric = 'metric',
  /** 스크린샷/대시보드 */
  Screenshot = 'screenshot',
  /** 테스트 결과 */
  TestResult = 'test_result',
  /** 인증서/증명서 */
  Certificate = 'certificate',
  /** 감사 보고서 */
  AuditReport = 'audit_report',
}

/** 증거 항목 */
export interface EvidenceItem {
  /** 증거 ID */
  id: string;
  /** CSAP 통제 영역 */
  domain: CSAPDomain;
  /** 통제 항목 ID (예: D-08-01) */
  controlId: string;
  /** 증거 유형 */
  type: EvidenceType;
  /** 증거 제목 */
  title: string;
  /** 증거 설명 */
  description: string;
  /** 파일 경로 또는 데이터 */
  source: string;
  /** 수집 시각 */
  collectedAt: string;
  /** SHA256 해시 */
  sha256: string;
  /** 파일 크기 (bytes) */
  sizeBytes: number;
  /** 메타데이터 */
  metadata?: Record<string, string | number>;
}

/** 증거 수집 결과 */
export interface EvidenceCollectionResult {
  /** 수집 ID */
  collectionId: string;
  /** 수집 시작 시각 */
  startedAt: string;
  /** 수집 완료 시각 */
  completedAt: string;
  /** 수집된 증거 목록 */
  items: EvidenceItem[];
  /** 영역별 커버리지 */
  coverage: DomainCoverage[];
  /** 전체 커버리지율 (%) */
  overallCoverageRate: number;
  /** 무결성 매니페스트 해시 */
  manifestHash: string;
  /** 수집 소요 시간 (ms) */
  durationMs: number;
}

/** 영역별 커버리지 */
export interface DomainCoverage {
  /** CSAP 영역 */
  domain: CSAPDomain;
  /** 영역명 */
  domainName: string;
  /** 전체 통제 항목 수 */
  totalControls: number;
  /** 증거가 있는 항목 수 */
  coveredControls: number;
  /** 커버리지율 (%) */
  coverageRate: number;
}

/** 증거 인덱스 (Markdown) */
export interface EvidenceIndex {
  /** 문서 ID */
  documentId: string;
  /** 생성일 */
  generatedAt: string;
  /** Markdown 본문 */
  content: string;
}

/**
 * CSAP 영역별 통제 항목 수
 * 중등급 기준 79개 항목
 */
const DOMAIN_CONTROL_COUNTS: Record<CSAPDomain, { name: string; count: number }> = {
  [CSAPDomain.D01]: { name: '정보보호 정책', count: 3 },
  [CSAPDomain.D02]: { name: '정보보호 조직', count: 4 },
  [CSAPDomain.D03]: { name: '인적 보안', count: 5 },
  [CSAPDomain.D04]: { name: '자산 관리', count: 4 },
  [CSAPDomain.D05]: { name: '물리적 보안', count: 6 },
  [CSAPDomain.D06]: { name: '침해사고 관리', count: 5 },
  [CSAPDomain.D07]: { name: '보안 교육', count: 3 },
  [CSAPDomain.D08]: { name: '접근 통제', count: 12 },
  [CSAPDomain.D09]: { name: '암호화', count: 4 },
  [CSAPDomain.D10]: { name: '운영 관리', count: 10 },
  [CSAPDomain.D11]: { name: '네트워크 보안', count: 8 },
  [CSAPDomain.D12]: { name: '시스템 개발 보안', count: 10 },
  [CSAPDomain.D13]: { name: '서비스 연속성', count: 5 },
};

export class CSAPEvidenceCollector {
  private evidenceItems: EvidenceItem[] = [];
  private collectionHistory: EvidenceCollectionResult[] = [];
  private readonly maxHistory = 100;

  /**
   * 증거 항목 추가
   * Design Ref: §FR-N253.1 — CSAP 증거 수집
   */
  addEvidence(item: Omit<EvidenceItem, 'id' | 'collectedAt' | 'sha256'>): EvidenceItem {
    const content = item.source;
    const sha256 = this.calculateHash(content);

    const evidence: EvidenceItem = {
      ...item,
      id: `EVD-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      collectedAt: new Date().toISOString(),
      sha256,
    };

    this.evidenceItems.push(evidence);
    return evidence;
  }

  /**
   * 전체 증거 수집 실행
   * Design Ref: §FR-N253.1 — 자동 수집
   */
  collect(): EvidenceCollectionResult {
    const startTime = Date.now();
    const startedAt = new Date().toISOString();

    // 영역별 커버리지 계산
    const coverage = this.calculateCoverage();

    // 전체 커버리지율
    const totalControls = coverage.reduce((sum, c) => sum + c.totalControls, 0);
    const coveredControls = coverage.reduce((sum, c) => sum + c.coveredControls, 0);
    const overallCoverageRate = totalControls > 0
      ? Math.round((coveredControls / totalControls) * 10000) / 100
      : 0;

    // 매니페스트 해시 생성
    const manifestHash = this.generateManifestHash();

    const result: EvidenceCollectionResult = {
      collectionId: `COL-${Date.now()}`,
      startedAt,
      completedAt: new Date().toISOString(),
      items: [...this.evidenceItems],
      coverage,
      overallCoverageRate,
      manifestHash,
      durationMs: Date.now() - startTime,
    };

    // 히스토리 저장
    this.collectionHistory.push(result);
    if (this.collectionHistory.length > this.maxHistory) {
      this.collectionHistory = this.collectionHistory.slice(-this.maxHistory);
    }

    return result;
  }

  /**
   * 증거 무결성 검증
   * Design Ref: §FR-N253.2 — SHA256 해시 기반 무결성 검증
   */
  verifyIntegrity(item: EvidenceItem): boolean {
    const expectedHash = this.calculateHash(item.source);
    return expectedHash === item.sha256;
  }

  /**
   * 전체 증거 무결성 일괄 검증
   */
  verifyAllIntegrity(): { valid: number; invalid: number; details: Array<{ id: string; valid: boolean }> } {
    let valid = 0;
    let invalid = 0;
    const details: Array<{ id: string; valid: boolean }> = [];

    for (const item of this.evidenceItems) {
      const isValid = this.verifyIntegrity(item);
      if (isValid) {
        valid++;
      } else {
        invalid++;
      }
      details.push({ id: item.id, valid: isValid });
    }

    return { valid, invalid, details };
  }

  /**
   * 증거 인덱스 Markdown 생성
   * Design Ref: §FR-N253.3 — 증거 인덱스 자동 생성
   */
  generateIndex(): EvidenceIndex {
    const now = new Date();
    const coverage = this.calculateCoverage();
    const sections: string[] = [];

    // 헤더
    sections.push('# CSAP 증거 수집 인덱스');
    sections.push('');
    sections.push(`> **수집일**: ${now.toISOString().split('T')[0]}`);
    sections.push(`> **증거 수**: ${this.evidenceItems.length}건`);
    sections.push(`> **CSAP 기준**: 중등급 79개 통제항목`);
    sections.push('');

    // 커버리지 요약
    sections.push('## 1. 영역별 커버리지 요약');
    sections.push('');
    sections.push('| 영역 | 영역명 | 전체 | 커버 | 커버율 |');
    sections.push('|------|--------|------|------|--------|');
    for (const c of coverage) {
      const rate = c.coverageRate >= 100 ? 'PASS' : `${c.coverageRate}%`;
      sections.push(`| ${c.domain} | ${c.domainName} | ${c.totalControls} | ${c.coveredControls} | ${rate} |`);
    }
    sections.push('');

    // 증거 목록 (영역별 그룹)
    sections.push('## 2. 증거 목록');
    sections.push('');

    const groupedByDomain = new Map<CSAPDomain, EvidenceItem[]>();
    for (const item of this.evidenceItems) {
      const existing = groupedByDomain.get(item.domain) || [];
      existing.push(item);
      groupedByDomain.set(item.domain, existing);
    }

    for (const [domain, items] of groupedByDomain) {
      const domainInfo = DOMAIN_CONTROL_COUNTS[domain];
      sections.push(`### ${domain} — ${domainInfo.name}`);
      sections.push('');
      sections.push('| ID | 통제 항목 | 증거 유형 | 제목 | SHA256 (앞 16자) |');
      sections.push('|----|----------|----------|------|-----------------|');
      for (const item of items) {
        sections.push(`| ${item.id} | ${item.controlId} | ${item.type} | ${item.title} | \`${item.sha256.slice(0, 16)}\` |`);
      }
      sections.push('');
    }

    // 무결성 검증
    sections.push('## 3. 무결성 검증');
    sections.push('');
    const integrity = this.verifyAllIntegrity();
    sections.push(`- 검증 통과: ${integrity.valid}건`);
    sections.push(`- 검증 실패: ${integrity.invalid}건`);
    sections.push(`- 전체 매니페스트 해시: \`${this.generateManifestHash()}\``);
    sections.push('');

    // 푸터
    sections.push('---');
    sections.push(`*본 인덱스는 CSAP Evidence Collector v2에 의해 자동 생성되었습니다. (${now.toISOString()})*`);

    return {
      documentId: `CSAP-EVD-INDEX-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`,
      generatedAt: now.toISOString(),
      content: sections.join('\n'),
    };
  }

  /**
   * 수집된 증거 수
   */
  getEvidenceCount(): number {
    return this.evidenceItems.length;
  }

  /**
   * 수집 히스토리 조회
   */
  getCollectionHistory(limit: number = 10): EvidenceCollectionResult[] {
    return this.collectionHistory.slice(-limit);
  }

  /**
   * 영역별 커버리지 계산
   */
  private calculateCoverage(): DomainCoverage[] {
    const coverage: DomainCoverage[] = [];

    for (const [domain, info] of Object.entries(DOMAIN_CONTROL_COUNTS)) {
      const domainItems = this.evidenceItems.filter(
        item => item.domain === domain,
      );

      // 고유 통제 항목 수 (중복 제거)
      const uniqueControls = new Set(domainItems.map(item => item.controlId));

      const coveredControls = Math.min(uniqueControls.size, info.count);
      const coverageRate = info.count > 0
        ? Math.round((coveredControls / info.count) * 10000) / 100
        : 0;

      coverage.push({
        domain: domain as CSAPDomain,
        domainName: info.name,
        totalControls: info.count,
        coveredControls,
        coverageRate,
      });
    }

    return coverage;
  }

  /**
   * SHA256 해시 계산
   * Design Ref: §FR-N253.2 — SHA256 해시 기반 무결성 검증
   */
  private calculateHash(content: string): string {
    return createHash('sha256').update(content, 'utf-8').digest('hex');
  }

  /**
   * 전체 매니페스트 해시 생성
   */
  private generateManifestHash(): string {
    const manifest = this.evidenceItems
      .map(item => `${item.id}:${item.sha256}`)
      .sort()
      .join('\n');

    return this.calculateHash(manifest);
  }
}
