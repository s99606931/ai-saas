import { describe, it, expect } from 'vitest';
import { ChatbotContextV2, type ConversationSession } from '../chatbot-context-v2';

describe('ChatbotContextV2', () => {
  const svc = new ChatbotContextV2();

  const emptySession: ConversationSession = {
    sessionId: 's1',
    userId: 'u1',
    messages: [],
    entities: {},
    intents: [],
    lastUpdated: 0,
  };

  it('adds messages', () => {
    const s1 = svc.addMessage(emptySession, { role: 'user', text: '안녕', timestamp: 1, tokens: 5 });
    expect(s1.messages.length).toBe(1);
  });

  it('tracks entities and intents', () => {
    let s = svc.trackEntities(emptySession, { city: '서울', date: '내일' });
    s = svc.trackIntent(s, '날씨질의');
    expect(s.entities['city']).toBe('서울');
    expect(s.intents).toContain('날씨질의');
  });

  it('summarizes within token budget', () => {
    let s = emptySession;
    for (let i = 0; i < 10; i++) {
      s = svc.addMessage(s, { role: 'user', text: `msg${i}`, timestamp: i, tokens: 10 });
    }
    const summary = svc.summarize(s, 50);
    expect(summary.tokenCount).toBeLessThanOrEqual(50);
    expect(summary.droppedMessages).toBeGreaterThan(0);
  });

  it('generates proactive suggestion on problem report', () => {
    let s = svc.trackIntent(emptySession, '문제보고');
    s = svc.addMessage(s, { role: 'user', text: '장애났어요', timestamp: 1, tokens: 10 });
    const sug = svc.generateSuggestion(s);
    expect(sug?.reason).toContain('문제보고');
  });

  it('evaluates multi turn metrics', () => {
    let s = emptySession;
    s = svc.addMessage(s, { role: 'user', text: 'q1', timestamp: 100, tokens: 5 });
    s = svc.addMessage(s, { role: 'assistant', text: 'a1', timestamp: 200, tokens: 5 });
    s = svc.trackEntities(s, { k1: 'v1', k2: 'v2' });
    const metric = svc.evaluate([s]);
    expect(metric.totalTurns).toBe(2);
    expect(metric.avgLatencyMs).toBe(100);
  });
});
