import { describe, it, expect, beforeEach } from 'vitest';
import { AIPublicWiFiOptimizer } from '../ai-public-wi-fi-optimizer';

describe('AIPublicWiFiOptimizer', () => {
  let ai: AIPublicWiFiOptimizer;

  beforeEach(() => {
    ai = new AIPublicWiFiOptimizer();
  });

  it('부하 90% 초과 시 offload', () => {
    ai.registerAP({
      apId: 'AP1',
      location: '시청',
      band: '5GHz',
      maxClients: 100,
      currentClients: 95,
      channel: 36,
      signalStrength: -60,
      throughputMbps: 300,
    });
    const plans = ai.optimize();
    expect(plans[0]?.action).toBe('offload');
  });

  it('간섭 채널 시 rechannel', () => {
    ai.registerAP({
      apId: 'AP2',
      location: '도서관',
      band: '2.4GHz',
      maxClients: 100,
      currentClients: 20,
      channel: 6,
      signalStrength: -60,
      throughputMbps: 50,
    });
    ai.reportInterference({ apId: 'AP2', neighborChannels: [6, 7, 5], noiseFloor: -85 });
    const plans = ai.optimize();
    expect(plans[0]?.action).toBe('rechannel');
    expect([1, 11]).toContain(plans[0]?.recommendedChannel);
  });

  it('신호 약함 시 boost-power', () => {
    ai.registerAP({
      apId: 'AP3',
      location: '공원',
      band: '5GHz',
      maxClients: 50,
      currentClients: 5,
      channel: 149,
      signalStrength: -80,
      throughputMbps: 100,
    });
    const plans = ai.optimize();
    expect(plans[0]?.action).toBe('boost-power');
  });

  it('정상 AP는 maintain', () => {
    ai.registerAP({
      apId: 'AP4',
      location: '시장',
      band: '5GHz',
      maxClients: 100,
      currentClients: 30,
      channel: 36,
      signalStrength: -55,
      throughputMbps: 250,
    });
    const plans = ai.optimize();
    expect(plans[0]?.action).toBe('maintain');
  });

  it('음수 클라이언트 오류', () => {
    expect(() =>
      ai.registerAP({
        apId: 'X',
        location: 'x',
        band: '5GHz',
        maxClients: 10,
        currentClients: -1,
        channel: 36,
        signalStrength: -50,
        throughputMbps: 10,
      }),
    ).toThrow();
  });

  it('감사 로그 OPTIMIZE 기록', () => {
    ai.registerAP({
      apId: 'AP5',
      location: 'x',
      band: '5GHz',
      maxClients: 10,
      currentClients: 1,
      channel: 36,
      signalStrength: -50,
      throughputMbps: 10,
    });
    ai.optimize();
    expect(ai.getAuditLog().some((a) => a.action === 'OPTIMIZE')).toBe(true);
  });
});
