import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeServiceHealthIndexAI, type ServiceMetrics } from '../realtime-service-health-index-ai';

describe('RealtimeServiceHealthIndexAI', () => {
  let calculator: RealtimeServiceHealthIndexAI;

  beforeEach(() => {
    calculator = new RealtimeServiceHealthIndexAI();
  });

  it('grades EXCELLENT for index>=90', () => {
    const services: ServiceMetrics[] = [
      { serviceId: 'SVC1', availability: 100, latencyScore: 95, errorScore: 90, saturationScore: 85 },
    ];
    const result = calculator.calculate(services);
    // 100*0.4 + 95*0.3 + 90*0.2 + 85*0.1 = 40+28.5+18+8.5=95
    expect(result[0]!.grade).toBe('EXCELLENT');
  });

  it('grades GOOD for index>=75 and <90', () => {
    const services: ServiceMetrics[] = [
      { serviceId: 'SVC2', availability: 85, latencyScore: 80, errorScore: 75, saturationScore: 70 },
    ];
    const result = calculator.calculate(services);
    // 85*0.4+80*0.3+75*0.2+70*0.1 = 34+24+15+7=80
    expect(result[0]!.grade).toBe('GOOD');
  });

  it('grades POOR for index<60', () => {
    const services: ServiceMetrics[] = [
      { serviceId: 'SVC3', availability: 50, latencyScore: 40, errorScore: 50, saturationScore: 60 },
    ];
    const result = calculator.calculate(services);
    // 50*0.4+40*0.3+50*0.2+60*0.1 = 20+12+10+6=48
    expect(result[0]!.grade).toBe('POOR');
  });

  it('identifies weakest metric', () => {
    const services: ServiceMetrics[] = [
      { serviceId: 'SVC4', availability: 90, latencyScore: 30, errorScore: 80, saturationScore: 85 },
    ];
    const result = calculator.calculate(services);
    expect(result[0]!.weakestMetric).toBe('latencyScore');
  });

  it('computes index with correct weights', () => {
    const services: ServiceMetrics[] = [
      { serviceId: 'SVC5', availability: 100, latencyScore: 0, errorScore: 0, saturationScore: 0 },
    ];
    const result = calculator.calculate(services);
    // 100*0.4 = 40
    expect(result[0]!.index).toBe(40);
  });

  it('records audit log', () => {
    calculator.calculate([
      { serviceId: 'SVC6', availability: 80, latencyScore: 80, errorScore: 80, saturationScore: 80 },
    ]);
    const log = calculator.getAuditLog();
    expect(log[0]!.action).toBe('health.calculate');
  });
});
