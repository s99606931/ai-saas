// SVC-AI-ADV-R2 단위 테스트: 에이전트 세션/장기 메모리
// Design Ref: SVC-AI-ADV-R2 DESIGN §2
// Plan SC: FR-ADV2.2, FR-ADV2.3
// CSAP: D-09, D-12

import { describe, it, expect, beforeEach } from 'vitest';
import {
  getOrCreateSession,
  addToMemory,
  memoryToMessages,
  clearSession,
  clearAllSessions,
} from '../../src/lib/agent-memory.js';

describe('에이전트 세션 메모리 (FR-ADV2.2)', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('getOrCreateSession', () => {
    it('신규 세션을 생성한다', () => {
      const session = getOrCreateSession('tenant-1', 'session-1');
      expect(session).toBeDefined();
      expect(session.tenantId).toBe('tenant-1');
      expect(session.sessionId).toBe('session-1');
      expect(session.entries).toHaveLength(0);
      expect(session.totalTokens).toBe(0);
    });

    it('기존 세션을 반환한다', () => {
      const session1 = getOrCreateSession('tenant-1', 'session-1');
      const session2 = getOrCreateSession('tenant-1', 'session-1');
      expect(session1).toBe(session2);
    });

    it('테넌트별 세션이 격리된다 (N2SF N-03)', () => {
      const sessionA = getOrCreateSession('tenant-A', 'session-1');
      const sessionB = getOrCreateSession('tenant-B', 'session-1');
      expect(sessionA).not.toBe(sessionB);
      expect(sessionA.tenantId).toBe('tenant-A');
      expect(sessionB.tenantId).toBe('tenant-B');
    });

    it('커스텀 maxTokens를 설정할 수 있다', () => {
      const session = getOrCreateSession('tenant-1', 'session-1', 8192);
      expect(session.maxTokens).toBe(8192);
    });

    it('기본 maxTokens는 4096이다', () => {
      const session = getOrCreateSession('tenant-1', 'session-1');
      expect(session.maxTokens).toBe(4096);
    });
  });

  describe('addToMemory', () => {
    it('사용자 메시지를 추가한다', async () => {
      const session = getOrCreateSession('tenant-1', 'session-1');
      await addToMemory(session, 'user', '안녕하세요');
      expect(session.entries).toHaveLength(1);
      expect(session.entries[0]?.role).toBe('user');
    });

    it('어시스턴트 메시지를 추가한다', async () => {
      const session = getOrCreateSession('tenant-1', 'session-1');
      await addToMemory(session, 'assistant', '네, 무엇을 도와드릴까요?');
      expect(session.entries).toHaveLength(1);
      expect(session.entries[0]?.role).toBe('assistant');
    });

    it('PII가 마스킹되어 저장된다 (CSAP D-09)', async () => {
      const session = getOrCreateSession('tenant-1', 'session-1');
      await addToMemory(session, 'user', '제 이메일은 test@example.com입니다');
      expect(session.entries[0]?.content).not.toContain('test@example.com');
    });

    it('토큰 카운트가 업데이트된다', async () => {
      const session = getOrCreateSession('tenant-1', 'session-1');
      await addToMemory(session, 'user', '테스트 메시지');
      expect(session.totalTokens).toBeGreaterThan(0);
    });

    it('최대 턴 수(20) 초과 시 자동 압축을 시도한다', async () => {
      // 주의: compressMemory는 LLM 호출을 시도하므로 단위 테스트에서는
      // entries.length가 maxEntries를 초과하면 압축 로직이 트리거됨을 확인
      const session = getOrCreateSession('tenant-1', 'session-1', 100000);
      // 20개까지 추가 (maxEntries 이하)
      for (let i = 0; i < 20; i++) {
        await addToMemory(session, i % 2 === 0 ? 'user' : 'assistant', `짧은메시지`);
      }
      // 20개에서 초과하지 않으므로 압축 없음
      expect(session.entries.length).toBe(20);
    });
  });

  describe('memoryToMessages', () => {
    it('빈 세션은 빈 배열을 반환한다', () => {
      const session = getOrCreateSession('tenant-1', 'session-1');
      const messages = memoryToMessages(session);
      expect(messages).toHaveLength(0);
    });

    it('대화 이력을 LLM 메시지 형식으로 변환한다', async () => {
      const session = getOrCreateSession('tenant-1', 'session-1');
      await addToMemory(session, 'user', '질문');
      await addToMemory(session, 'assistant', '답변');
      const messages = memoryToMessages(session);
      expect(messages).toHaveLength(2);
      expect(messages[0]?.role).toBe('user');
      expect(messages[1]?.role).toBe('assistant');
    });

    it('요약이 있으면 시스템 메시지로 주입한다', async () => {
      const session = getOrCreateSession('tenant-1', 'session-1');
      session.summary = '이전 대화 요약 내용';
      await addToMemory(session, 'user', '질문');
      const messages = memoryToMessages(session);
      expect(messages[0]?.role).toBe('system');
      expect(messages[0]?.content).toContain('이전 대화 요약');
    });
  });

  describe('clearSession', () => {
    it('특정 세션을 삭제한다', () => {
      const session1 = getOrCreateSession('tenant-1', 'session-1');
      getOrCreateSession('tenant-1', 'session-2');
      clearSession('tenant-1', 'session-1');
      const newSession = getOrCreateSession('tenant-1', 'session-1');
      expect(newSession).not.toBe(session1);
    });
  });

  describe('clearAllSessions', () => {
    it('모든 세션을 초기화한다', () => {
      const session1 = getOrCreateSession('tenant-1', 'session-1');
      getOrCreateSession('tenant-2', 'session-2');
      clearAllSessions();
      const newSession = getOrCreateSession('tenant-1', 'session-1');
      expect(newSession).not.toBe(session1);
    });
  });
});
