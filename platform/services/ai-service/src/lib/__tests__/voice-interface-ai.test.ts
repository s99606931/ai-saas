import { describe, it, expect } from 'vitest';
import { VoiceInterfaceAi } from '../voice-interface-ai';

describe('VoiceInterfaceAi', () => {
  const svc = new VoiceInterfaceAi();

  it('validates STT result', () => {
    expect(svc.validateStt({ text: '안녕', confidence: 0.9, language: 'ko', durationMs: 1000 })).toBe(true);
    expect(svc.validateStt({ text: '', confidence: 0.9, language: 'ko', durationMs: 1000 })).toBe(false);
  });

  it('classifies navigate intent', () => {
    const c = svc.classifyIntent('대시보드로 이동');
    expect(c.intent).toBe('navigate');
    expect(c.entities['page']).toBe('대시보드');
  });

  it('classifies command intent', () => {
    const c = svc.classifyIntent('사용자 생성해');
    expect(c.intent).toBe('command');
  });

  it('classifies query intent', () => {
    const c = svc.classifyIntent('오늘 알림이 얼마나 있어?');
    expect(c.intent).toBe('query');
  });

  it('routes navigate command', () => {
    const c = svc.classifyIntent('설정 열어');
    const route = svc.routeCommand(c);
    expect(route?.action).toBe('navigate');
    expect(route?.target).toBe('설정');
  });

  it('builds TTS request', () => {
    const tts = svc.buildTtsRequest('응답입니다');
    expect(tts.voice).toContain('ko');
  });

  it('appends conversation turn and caps at 50', () => {
    let history: ReturnType<typeof svc.appendTurn> = [];
    for (let i = 0; i < 60; i++) {
      history = svc.appendTurn(history, { userText: `u${i}`, intent: 'query', responseText: `r${i}` }, i);
    }
    expect(history.length).toBe(50);
  });
});
