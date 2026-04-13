import { describe, it, expect, beforeEach } from 'vitest';
import { InfraCostForecasterAI } from '../infra-cost-forecaster-ai';

describe('InfraCostForecasterAI', () => {
  let forecaster: InfraCostForecasterAI;

  beforeEach(() => {
    forecaster = new InfraCostForecasterAI();
  });

  it('리소스를 등록한다', () => {
    forecaster.registerResource('ec2', 'EC2 t3.medium', 0.05, 100);
    expect(forecaster.getAuditLog().some(l => l.action === 'REGISTER_RESOURCE')).toBe(true);
  });

  it('사용량을 기록한다', () => {
    forecaster.registerResource('ec2', 'EC2', 0.05, 100);
    forecaster.recordUsage('ec2', 100, '2026-04-01');
    expect(forecaster.getAuditLog().some(l => l.action === 'RECORD_USAGE')).toBe(true);
  });

  it('상승 추세 예측을 반환한다', () => {
    forecaster.registerResource('ec2', 'EC2', 1, 500);
    for (let i = 1; i <= 10; i++) {
      forecaster.recordUsage('ec2', i * 10, `2026-04-0${i}`);
    }
    const result = forecaster.forecast('ec2', 5);
    expect(result.predictedUsage).toBeGreaterThan(100);
    expect(result.predictedCost).toBeGreaterThan(0);
  });

  it('데이터 없으면 predictedUsage=0이다', () => {
    forecaster.registerResource('ec2', 'EC2', 1, 500);
    const result = forecaster.forecast('ec2', 10);
    expect(result.predictedUsage).toBe(0);
    expect(result.confidence).toBe('low');
  });

  it('예산 초과 경고를 반환한다', () => {
    forecaster.registerResource('ec2', 'EC2', 10, 100);
    for (let i = 1; i <= 10; i++) {
      forecaster.recordUsage('ec2', 20, `2026-04-0${i}`);
    }
    const alerts = forecaster.getBudgetAlerts();
    expect(alerts.length).toBeGreaterThan(0);
    expect(alerts[0]!.predictedMonthlyCost).toBeGreaterThan(100);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    forecaster.registerResource('ec2', 'EC2', 1, 100);
    expect(() => forecaster.recordUsage('ec2', 100, '2026-04-01', 'C' as never)).toThrow('BLOCKED');
  });

  it('음수 사용량 기록 시 오류를 던진다', () => {
    forecaster.registerResource('ec2', 'EC2', 1, 100);
    expect(() => forecaster.recordUsage('ec2', -10, '2026-04-01')).toThrow('0 이상');
  });

  it('14일 이상 데이터는 high 신뢰도를 반환한다', () => {
    forecaster.registerResource('ec2', 'EC2', 1, 9999);
    for (let i = 1; i <= 14; i++) {
      forecaster.recordUsage('ec2', 100, `2026-04-${String(i).padStart(2, '0')}`);
    }
    const result = forecaster.forecast('ec2', 1);
    expect(result.confidence).toBe('high');
  });
});
