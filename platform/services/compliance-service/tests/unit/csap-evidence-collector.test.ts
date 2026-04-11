/**
 * CSAP 증거 수집기 v2 단위 테스트
 * Design Ref: MTU-N253 Design
 * Plan SC: FR-N253.1~FR-N253.5
 * CSAP: D-01~D-13 전 영역 커버
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  CSAPEvidenceCollector,
  CSAPDomain,
  EvidenceType,
} from '../../src/lib/csap-evidence-collector';

describe('CSAPEvidenceCollector', () => {
  let collector: CSAPEvidenceCollector;

  beforeEach(() => {
    collector = new CSAPEvidenceCollector();
  });

  describe('addEvidence', () => {
    it('증거 항목 추가 성공', () => {
      const evidence = collector.addEvidence({
        domain: CSAPDomain.D08,
        controlId: 'D-08-01',
        type: EvidenceType.Configuration,
        title: 'RBAC 정책 설정',
        description: 'Kubernetes RBAC ClusterRole/RoleBinding 설정',
        source: 'apiVersion: rbac.authorization.k8s.io/v1\nkind: ClusterRole',
        sizeBytes: 256,
      });

      expect(evidence.id).toMatch(/^EVD-/);
      expect(evidence.sha256).toHaveLength(64);
      expect(evidence.collectedAt).toBeTruthy();
      expect(evidence.domain).toBe(CSAPDomain.D08);
    });

    it('SHA256 해시 자동 계산', () => {
      const evidence = collector.addEvidence({
        domain: CSAPDomain.D09,
        controlId: 'D-09-01',
        type: EvidenceType.Configuration,
        title: 'TLS 설정',
        description: 'TLS 1.3 인증서 설정',
        source: 'tls: {minVersion: "1.3"}',
        sizeBytes: 32,
      });

      expect(evidence.sha256).toHaveLength(64);
      // 같은 내용이면 같은 해시
      const evidence2 = collector.addEvidence({
        domain: CSAPDomain.D09,
        controlId: 'D-09-02',
        type: EvidenceType.Configuration,
        title: 'TLS 설정 2',
        description: 'TLS 1.3 인증서 설정 2',
        source: 'tls: {minVersion: "1.3"}',
        sizeBytes: 32,
      });

      expect(evidence.sha256).toBe(evidence2.sha256);
    });

    it('증거 수 추적', () => {
      expect(collector.getEvidenceCount()).toBe(0);

      collector.addEvidence({
        domain: CSAPDomain.D06,
        controlId: 'D-06-01',
        type: EvidenceType.Log,
        title: '감사 로그',
        description: '감사 로그 파일',
        source: '{"action":"login","ts":"2026-04-12"}',
        sizeBytes: 48,
      });

      expect(collector.getEvidenceCount()).toBe(1);
    });
  });

  describe('verifyIntegrity', () => {
    it('무결성 검증 통과', () => {
      const evidence = collector.addEvidence({
        domain: CSAPDomain.D06,
        controlId: 'D-06-01',
        type: EvidenceType.Log,
        title: '감사 로그',
        description: '감사 로그',
        source: 'audit log content',
        sizeBytes: 18,
      });

      expect(collector.verifyIntegrity(evidence)).toBe(true);
    });

    it('변조된 증거 감지', () => {
      const evidence = collector.addEvidence({
        domain: CSAPDomain.D06,
        controlId: 'D-06-01',
        type: EvidenceType.Log,
        title: '감사 로그',
        description: '감사 로그',
        source: 'original content',
        sizeBytes: 16,
      });

      // 내용 변조
      const tampered = { ...evidence, source: 'tampered content' };
      expect(collector.verifyIntegrity(tampered)).toBe(false);
    });
  });

  describe('verifyAllIntegrity', () => {
    it('전체 무결성 일괄 검증', () => {
      collector.addEvidence({
        domain: CSAPDomain.D08,
        controlId: 'D-08-01',
        type: EvidenceType.Configuration,
        title: 'RBAC',
        description: 'RBAC 설정',
        source: 'rbac config',
        sizeBytes: 11,
      });

      collector.addEvidence({
        domain: CSAPDomain.D09,
        controlId: 'D-09-01',
        type: EvidenceType.Configuration,
        title: 'TLS',
        description: 'TLS 설정',
        source: 'tls config',
        sizeBytes: 10,
      });

      const result = collector.verifyAllIntegrity();

      expect(result.valid).toBe(2);
      expect(result.invalid).toBe(0);
      expect(result.details).toHaveLength(2);
    });
  });

  describe('collect', () => {
    it('수집 결과 생성', () => {
      collector.addEvidence({
        domain: CSAPDomain.D08,
        controlId: 'D-08-01',
        type: EvidenceType.Configuration,
        title: 'RBAC',
        description: 'RBAC',
        source: 'rbac',
        sizeBytes: 4,
      });

      const result = collector.collect();

      expect(result.collectionId).toMatch(/^COL-/);
      expect(result.items).toHaveLength(1);
      expect(result.coverage).toHaveLength(13); // 13개 CSAP 영역
      expect(result.manifestHash).toHaveLength(64);
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('영역별 커버리지 계산', () => {
      // D-08 영역에 3개 통제 항목 증거 추가
      for (let i = 1; i <= 3; i++) {
        collector.addEvidence({
          domain: CSAPDomain.D08,
          controlId: `D-08-${String(i).padStart(2, '0')}`,
          type: EvidenceType.Configuration,
          title: `접근 통제 ${i}`,
          description: `접근 통제 ${i}`,
          source: `config ${i}`,
          sizeBytes: 8,
        });
      }

      const result = collector.collect();
      const d08Coverage = result.coverage.find(c => c.domain === CSAPDomain.D08);

      expect(d08Coverage).toBeTruthy();
      expect(d08Coverage!.totalControls).toBe(12);
      expect(d08Coverage!.coveredControls).toBe(3);
      expect(d08Coverage!.coverageRate).toBe(25);
    });

    it('전체 커버리지율 계산', () => {
      // 증거 없으면 0%
      const emptyResult = collector.collect();
      expect(emptyResult.overallCoverageRate).toBe(0);
    });

    it('수집 히스토리 저장', () => {
      collector.collect();
      collector.collect();

      const history = collector.getCollectionHistory();
      expect(history).toHaveLength(2);
    });
  });

  describe('generateIndex', () => {
    it('Markdown 인덱스 생성', () => {
      collector.addEvidence({
        domain: CSAPDomain.D06,
        controlId: 'D-06-01',
        type: EvidenceType.Log,
        title: '감사 로그',
        description: '감사 로그',
        source: 'audit log',
        sizeBytes: 9,
      });

      collector.addEvidence({
        domain: CSAPDomain.D08,
        controlId: 'D-08-01',
        type: EvidenceType.Configuration,
        title: 'RBAC 설정',
        description: 'RBAC',
        source: 'rbac',
        sizeBytes: 4,
      });

      const index = collector.generateIndex();

      expect(index.documentId).toMatch(/^CSAP-EVD-INDEX-/);
      expect(index.content).toContain('# CSAP 증거 수집 인덱스');
      expect(index.content).toContain('영역별 커버리지 요약');
      expect(index.content).toContain('증거 목록');
      expect(index.content).toContain('무결성 검증');
      expect(index.content).toContain('D-06');
      expect(index.content).toContain('D-08');
      expect(index.content).toContain('감사 로그');
      expect(index.content).toContain('RBAC 설정');
    });

    it('빈 수집기에서도 인덱스 생성 가능', () => {
      const index = collector.generateIndex();

      expect(index.content).toContain('# CSAP 증거 수집 인덱스');
      expect(index.content).toContain('영역별 커버리지 요약');
    });
  });

  describe('CSAP 영역 전체 커버리지', () => {
    it('13개 CSAP 영역 모두 정의', () => {
      const result = collector.collect();

      expect(result.coverage).toHaveLength(13);

      // 전체 79개 통제 항목
      const totalControls = result.coverage.reduce((sum, c) => sum + c.totalControls, 0);
      expect(totalControls).toBe(79);
    });

    it('모든 영역에 증거 추가 가능', () => {
      const domains = [
        CSAPDomain.D01, CSAPDomain.D02, CSAPDomain.D03,
        CSAPDomain.D04, CSAPDomain.D05, CSAPDomain.D06,
        CSAPDomain.D07, CSAPDomain.D08, CSAPDomain.D09,
        CSAPDomain.D10, CSAPDomain.D11, CSAPDomain.D12,
        CSAPDomain.D13,
      ];

      for (const domain of domains) {
        collector.addEvidence({
          domain,
          controlId: `${domain}-01`,
          type: EvidenceType.Policy,
          title: `${domain} 정책`,
          description: `${domain} 정책 문서`,
          source: `${domain} policy content`,
          sizeBytes: 20,
        });
      }

      const result = collector.collect();

      // 모든 영역에 최소 1개 증거
      for (const cov of result.coverage) {
        expect(cov.coveredControls).toBeGreaterThanOrEqual(1);
      }
    });
  });

  describe('증거 유형', () => {
    it('모든 증거 유형 지원', () => {
      const types = [
        EvidenceType.Policy,
        EvidenceType.Configuration,
        EvidenceType.Log,
        EvidenceType.Metric,
        EvidenceType.Screenshot,
        EvidenceType.TestResult,
        EvidenceType.Certificate,
        EvidenceType.AuditReport,
      ];

      for (const type of types) {
        const evidence = collector.addEvidence({
          domain: CSAPDomain.D06,
          controlId: 'D-06-01',
          type,
          title: `${type} 증거`,
          description: `${type} 유형 테스트`,
          source: `${type} content`,
          sizeBytes: 15,
        });

        expect(evidence.type).toBe(type);
      }
    });
  });
});
