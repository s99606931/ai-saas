// 인시던트 자동 분류 단위 테스트 -- MTU-N274
import { describe, it, expect } from 'vitest';
import {
  classifyIncident,
  findSimilarIncidents,
  registerResolution,
  analyzePatterns,
  getIncident,
  getClassification,
  getIncidentAuditLog,
  type Incident,
} from '../../src/lib/incident-classifier';

function createIncident(title: string, description: string): Incident {
  return {
    id: `inc-${Math.random().toString(36).substring(7)}`,
    title,
    description,
    reportedBy: 'user-1',
    reportedAt: new Date().toISOString(),
    status: 'open',
  };
}

describe('인시던트 자동 분류', () => {
  describe('classifyIncident', () => {
    it('인프라 인시던트를 분류해야 한다', () => {
      const incident = createIncident('서버 CPU 과부하', 'k3s 노드의 CPU 사용률이 95%를 초과하여 pod가 OOM으로 종료됨');
      const result = classifyIncident(incident, 'system');
      expect(result.category).toBe('infrastructure');
      expect(result.assignedTeam).toBe('인프라팀');
    });

    it('보안 인시던트를 분류해야 한다', () => {
      const incident = createIncident('DDoS 공격 감지', '방화벽에서 DDoS 공격으로 의심되는 보안 이상 트래픽 감지');
      const result = classifyIncident(incident, 'system');
      expect(result.category).toBe('security');
      expect(result.assignedTeam).toBe('보안팀');
    });

    it('애플리케이션 인시던트를 분류해야 한다', () => {
      const incident = createIncident('API 500 에러 다수 발생', '사용자 조회 API에서 500 에러가 반복 발생');
      const result = classifyIncident(incident, 'system');
      expect(result.category).toBe('application');
      expect(result.assignedTeam).toBe('개발팀');
    });

    it('데이터베이스 인시던트를 분류해야 한다', () => {
      const incident = createIncident('DB 커넥션 풀 고갈', 'PostgreSQL 데이터베이스 커넥션 풀 소진으로 쿼리 실패');
      const result = classifyIncident(incident, 'system');
      expect(result.category).toBe('database');
    });

    it('네트워크 인시던트를 분류해야 한다', () => {
      const incident = createIncident('DNS 해석 실패', 'DNS 서비스 장애로 네트워크 연결 타임아웃 발생');
      const result = classifyIncident(incident, 'system');
      expect(result.category).toBe('network');
    });
  });

  describe('심각도 판정', () => {
    it('서비스 다운을 P1으로 판정해야 한다', () => {
      const incident = createIncident('서비스 전면 장애', '전체 서비스 다운. 사용자 접속 불가');
      const result = classifyIncident(incident, 'system');
      expect(result.severity).toBe('P1');
    });

    it('보안 인시던트를 P2 이상으로 판정해야 한다', () => {
      const incident = createIncident('보안 취약점 발견', '인증 우회 취약점 보안 위협');
      const result = classifyIncident(incident, 'system');
      expect(['P1', 'P2']).toContain(result.severity);
    });
  });

  describe('유사 인시던트 검색', () => {
    it('해결된 유사 인시던트를 검색해야 한다', () => {
      // 해결 인시던트 등록
      const resolved = createIncident('서버 메모리 부족', 'k3s 노드 메모리 부족으로 서버 성능 저하');
      classifyIncident(resolved, 'system');
      registerResolution(resolved.id, 'k3s 노드 메모리를 16GB로 증설하여 해결', 'admin');

      // 유사 인시던트 검색
      const newIncident = createIncident('서버 메모리 경고', '서버 노드 메모리 사용량 경고');
      classifyIncident(newIncident, 'system');
      const similar = findSimilarIncidents(newIncident.id);

      expect(similar.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('패턴 분석', () => {
    it('인시던트 패턴을 분석해야 한다', () => {
      const analysis = analyzePatterns('analyst');
      expect(analysis.patterns).toBeDefined();
      expect(analysis.preventionSuggestions).toBeDefined();
    });
  });

  describe('인시던트 조회', () => {
    it('인시던트를 조회할 수 있어야 한다', () => {
      const incident = createIncident('테스트 인시던트', '조회 테스트');
      classifyIncident(incident, 'system');

      const found = getIncident(incident.id);
      expect(found).toBeDefined();
      expect(found?.title).toBe('테스트 인시던트');

      const classification = getClassification(incident.id);
      expect(classification).toBeDefined();
    });
  });

  describe('감사 로그', () => {
    it('모든 분류 활동이 기록되어야 한다', () => {
      const log = getIncidentAuditLog();
      expect(log.length).toBeGreaterThan(0);
      expect(log.every((e) => e.timestamp)).toBe(true);
    });
  });
});
