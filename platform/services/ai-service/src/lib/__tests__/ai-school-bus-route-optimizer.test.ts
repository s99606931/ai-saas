import { describe, it, expect, beforeEach } from 'vitest';
import { SchoolBusRouteOptimizer } from '../ai-school-bus-route-optimizer';

describe('SchoolBusRouteOptimizer', () => {
  let ai: SchoolBusRouteOptimizer;

  beforeEach(() => {
    ai = new SchoolBusRouteOptimizer();
  });

  it('학생과 정류장을 등록한다', () => {
    ai.addStudent({ studentId: 's1', lat: 37.5, lng: 127.0, schoolId: 'sch1', needsAssistance: false });
    ai.createStop({ stopId: 'stop1', lat: 37.51, lng: 127.0 });
    expect(ai.getStop('stop1')).toBeDefined();
  });

  it('최근접 정류장에 배정한다', () => {
    ai.addStudent({ studentId: 's1', lat: 37.5, lng: 127.0, schoolId: 'sch1', needsAssistance: false });
    ai.createStop({ stopId: 'near', lat: 37.501, lng: 127.001 });
    ai.createStop({ stopId: 'far', lat: 38.0, lng: 128.0 });
    const stopId = ai.assignNearestStop('s1');
    expect(stopId).toBe('near');
  });

  it('노선을 최적화한다', () => {
    ai.createStop({ stopId: 'a', lat: 37.5, lng: 127.0 });
    ai.createStop({ stopId: 'b', lat: 37.51, lng: 127.01 });
    ai.createStop({ stopId: 'c', lat: 37.52, lng: 127.02 });
    const route = ai.optimizeRoute('r1', 'sch1', ['a', 'b', 'c']);
    expect(route.stopSequence.length).toBe(3);
    expect(route.totalDistanceKm).toBeGreaterThan(0);
  });

  it('잘못된 좌표는 거부한다', () => {
    expect(() =>
      ai.addStudent({ studentId: 's1', lat: 999, lng: 127.0, schoolId: 'sch1', needsAssistance: false }),
    ).toThrow('좌표');
  });

  it('미등록 정류장에 대한 노선 최적화는 거부한다', () => {
    expect(() => ai.optimizeRoute('r1', 'sch1', ['unknown'])).toThrow('미등록');
  });

  it('C등급 데이터는 차단한다', () => {
    expect(() =>
      ai.addStudent(
        { studentId: 's1', lat: 37.5, lng: 127.0, schoolId: 'sch1', needsAssistance: false },
        'C',
      ),
    ).toThrow('BLOCKED');
  });
});
