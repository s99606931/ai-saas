/**
 * DORA 주간 보고서 생성기
 * Design Ref: docs/02-design/mtus/MTU-N251-dora-four-keys.design.md §3.2, §3.8
 * Plan SC: FR-N251.9
 *
 * Markdown 형식의 DORA 주간 보고서 생성
 * 감리 증빙 포맷 (행안부 양식) 준수
 */

import { DORALevel } from './classifier';
import { TrendAnalyzer, TrendReport, TrendSnapshot, ImprovementMetrics } from './trend-analyzer';

/** 감사 증빙 형식 */
export interface AuditEvidence {
  /** 문서 ID */
  documentId: string;
  /** 보고 기간 */
  period: string;
  /** 생성일 */
  generatedAt: string;
  /** CSAP 매핑 */
  csapRef: string[];
  /** 보고서 본문 (Markdown) */
  content: string;
}

/** 보고서 설정 */
export interface ReportConfig {
  /** 팀 이름 (기본: 전체) */
  team?: string;
  /** CSAP 참조 항목 */
  csapRefs?: string[];
  /** 보고서 제목 접두사 */
  titlePrefix?: string;
}

const LEVEL_LABELS: Record<DORALevel, string> = {
  [DORALevel.Elite]: 'Elite',
  [DORALevel.High]: 'High',
  [DORALevel.Medium]: 'Medium',
  [DORALevel.Low]: 'Low',
};

const LEVEL_EMOJI: Record<DORALevel, string> = {
  [DORALevel.Elite]: '[ELITE]',
  [DORALevel.High]: '[HIGH]',
  [DORALevel.Medium]: '[MEDIUM]',
  [DORALevel.Low]: '[LOW]',
};

export class ReportGenerator {
  private readonly trendAnalyzer: TrendAnalyzer;

  constructor(trendAnalyzer: TrendAnalyzer) {
    this.trendAnalyzer = trendAnalyzer;
  }

  /**
   * 주간 DORA 보고서 Markdown 생성
   * Design Ref: §3.8 — 감리 증빙 형식
   */
  generateWeeklyReport(config?: ReportConfig): string {
    const report = this.trendAnalyzer.analyzeWeekly();
    return this.buildMarkdown(report, config);
  }

  /**
   * 월간 DORA 보고서 Markdown 생성
   */
  generateMonthlyReport(config?: ReportConfig): string {
    const report = this.trendAnalyzer.analyzeMonthly();
    return this.buildMarkdown(report, config);
  }

  /**
   * 감사 증빙 형식 보고서 생성
   * Design Ref: §3.8 — CSAP D-06 증빙
   */
  generateAuditEvidence(config?: ReportConfig): AuditEvidence {
    const report = this.trendAnalyzer.analyzeWeekly();
    const now = new Date();
    const weekNum = this.getWeekNumber(now);

    return {
      documentId: `DORA-EVIDENCE-${now.getFullYear()}-W${weekNum}`,
      period: `${now.getFullYear()}년 ${weekNum}주차`,
      generatedAt: now.toISOString(),
      csapRef: config?.csapRefs || ['D-06', 'D-12'],
      content: this.buildMarkdown(report, config),
    };
  }

  /**
   * Markdown 보고서 본문 생성
   */
  private buildMarkdown(report: TrendReport, config?: ReportConfig): string {
    const now = new Date();
    const title = config?.titlePrefix
      ? `${config.titlePrefix} DORA Four Keys 보고서`
      : `DORA Four Keys ${report.period === 'weekly' ? '주간' : '월간'} 보고서`;

    const sections: string[] = [];

    // 헤더
    sections.push(`# ${title}`);
    sections.push('');
    sections.push(`> **생성일**: ${now.toISOString().split('T')[0]}`);
    sections.push(`> **분석 기간**: ${report.period === 'weekly' ? '최근 7일' : '최근 30일'}`);
    if (config?.team) {
      sections.push(`> **대상 팀**: ${config.team}`);
    }
    sections.push(`> **CSAP 참조**: ${(config?.csapRefs || ['D-06', 'D-12']).join(', ')}`);
    sections.push('');

    // Four Keys 요약
    sections.push('## 1. Four Keys 종합 요약');
    sections.push('');
    sections.push(this.buildSummaryTable(report.current));
    sections.push('');

    // DORA 등급
    sections.push('## 2. DORA 종합 등급');
    sections.push('');
    sections.push(`**현재 등급**: ${LEVEL_EMOJI[report.current.level]} ${LEVEL_LABELS[report.current.level]}`);
    sections.push('');

    if (report.previous) {
      const prevLabel = LEVEL_LABELS[report.previous.level];
      const change = report.current.level > report.previous.level ? '상승' :
        report.current.level < report.previous.level ? '하락' : '유지';
      sections.push(`**이전 기간**: ${prevLabel} -> **${change}**`);
      sections.push('');
    }

    // 개선율 섹션
    if (report.improvement) {
      sections.push('## 3. 지표 변화 분석');
      sections.push('');
      sections.push(this.buildImprovementTable(report.improvement));
      sections.push('');
    }

    // 권고사항
    sections.push(`## ${report.improvement ? '4' : '3'}. 개선 권고사항`);
    sections.push('');
    for (const rec of report.recommendations) {
      sections.push(`- ${rec}`);
    }
    sections.push('');

    // 감사 증빙 섹션
    sections.push(`## ${report.improvement ? '5' : '4'}. CSAP 감사 증빙`);
    sections.push('');
    sections.push('| CSAP 항목 | 증빙 내용 | 상태 |');
    sections.push('|-----------|----------|------|');
    sections.push(`| D-06 침해사고 관리 | MTTR 자동 측정: ${this.formatDuration(report.current.mttrSeconds)} | ${report.current.mttrSeconds <= 3600 ? 'PASS' : 'REVIEW'} |`);
    sections.push(`| D-12 시스템 개발 보안 | CFR: ${(report.current.changeFailureRate * 100).toFixed(1)}%, 배포 빈도: ${report.current.deploymentFrequency.toFixed(2)}/일 | ${report.current.changeFailureRate <= 0.15 ? 'PASS' : 'REVIEW'} |`);
    sections.push('');

    // 푸터
    sections.push('---');
    sections.push(`*본 보고서는 DORA Exporter v2에 의해 자동 생성되었습니다. (${now.toISOString()})*`);

    return sections.join('\n');
  }

  /**
   * Four Keys 요약 테이블
   */
  private buildSummaryTable(snapshot: TrendSnapshot): string {
    const lines: string[] = [];
    lines.push('| 지표 | 값 | 개별 등급 기준 |');
    lines.push('|------|-----|--------------|');
    lines.push(`| 배포 빈도 (Deployment Frequency) | ${snapshot.deploymentFrequency.toFixed(2)}회/일 | Elite >= 2/일, High >= 1/주 |`);
    lines.push(`| 변경 리드타임 (Lead Time) | ${this.formatDuration(snapshot.leadTimeSeconds)} | Elite < 1시간, High < 1일 |`);
    lines.push(`| 변경 실패율 (Change Failure Rate) | ${(snapshot.changeFailureRate * 100).toFixed(1)}% | Elite < 5%, High < 10% |`);
    lines.push(`| 평균 복구시간 (MTTR) | ${this.formatDuration(snapshot.mttrSeconds)} | Elite < 1시간, High < 1일 |`);
    lines.push(`| **종합 등급** | **${LEVEL_LABELS[snapshot.level]}** | 병목 원리 (최저 등급 = 종합) |`);
    return lines.join('\n');
  }

  /**
   * 개선율 테이블
   */
  private buildImprovementTable(improvement: ImprovementMetrics): string {
    const lines: string[] = [];
    lines.push('| 지표 | 변화율 | 방향 |');
    lines.push('|------|--------|------|');
    lines.push(`| 배포 빈도 | ${this.formatChange(improvement.deploymentFrequencyChange)} | ${improvement.deploymentFrequencyChange >= 0 ? '개선' : '악화'} |`);
    lines.push(`| 리드타임 | ${this.formatChange(improvement.leadTimeChange)} | ${improvement.leadTimeChange <= 0 ? '개선' : '악화'} |`);
    lines.push(`| 변경 실패율 | ${this.formatChange(improvement.changeFailureRateChange)} | ${improvement.changeFailureRateChange <= 0 ? '개선' : '악화'} |`);
    lines.push(`| MTTR | ${this.formatChange(improvement.mttrChange)} | ${improvement.mttrChange <= 0 ? '개선' : '악화'} |`);
    lines.push(`| **종합 점수** | **${improvement.overallScore.toFixed(1)}/100** | ${improvement.overallScore >= 50 ? '개선' : '악화'} |`);
    return lines.join('\n');
  }

  /**
   * 초 단위를 사람이 읽을 수 있는 시간 형식으로 변환
   */
  private formatDuration(seconds: number): string {
    if (seconds < 60) return `${Math.round(seconds)}초`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}분`;
    if (seconds < 86400) return `${(seconds / 3600).toFixed(1)}시간`;
    return `${(seconds / 86400).toFixed(1)}일`;
  }

  /**
   * 변화율 포맷팅 (+/-%)
   */
  private formatChange(change: number): string {
    const sign = change >= 0 ? '+' : '';
    return `${sign}${change.toFixed(1)}%`;
  }

  /**
   * ISO 주차 번호 계산
   */
  private getWeekNumber(date: Date): number {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  }
}
