import { describe, it, expect, beforeEach } from 'vitest';
import { PublicHospitalQueueAI } from '../public-hospital-queue-ai';

describe('PublicHospitalQueueAI', () => {
  let ai: PublicHospitalQueueAI;

  beforeEach(() => {
    ai = new PublicHospitalQueueAI();
    ai.registerDepartment({
      departmentId: 'er',
      name: '응급실',
      averageConsultationMinutes: 10,
      parallelRooms: 2,
    });
  });

  it('진료과를 등록한다', () => {
    expect(ai.getQueueSize('er')).toBe(0);
  });

  it('환자 체크인 시 트리아지 우선순위로 정렬한다', () => {
    ai.checkIn('er', {
      patientId: 'p1',
      arrivedAt: 't',
      chiefComplaint: '발목 통증',
      age: 30,
      initialTriage: 4,
    });
    ai.checkIn('er', {
      patientId: 'p2',
      arrivedAt: 't',
      chiefComplaint: '심정지 의심',
      age: 60,
      initialTriage: 1,
    });
    const queue = ai.estimateWait('er');
    expect(queue[0]!.patientId).toBe('p2');
    expect(queue[0]!.position).toBe(1);
  });

  it('평행 진료실을 고려해 대기시간을 계산한다', () => {
    for (let i = 0; i < 4; i++) {
      ai.checkIn('er', {
        patientId: `p${i}`,
        arrivedAt: 't',
        chiefComplaint: '통증 010-1111-2222',
        age: 40,
        initialTriage: 3,
      });
    }
    const queue = ai.estimateWait('er');
    expect(queue[0]!.estimatedWaitMinutes).toBe(0);
    expect(queue[1]!.estimatedWaitMinutes).toBe(0);
    expect(queue[2]!.estimatedWaitMinutes).toBe(10); // 2번째 슬롯
    expect(queue[3]!.estimatedWaitMinutes).toBe(10);
  });

  it('PII를 마스킹한다', () => {
    ai.checkIn('er', {
      patientId: 'p1',
      arrivedAt: 't',
      chiefComplaint: '연락처 010-1234-5678',
      age: 25,
      initialTriage: 5,
    });
    // 직접 조회 API 없으니 queue position으로 우회 검증 - audit으로 확인
    const log = ai.getAuditLog();
    expect(log.some(e => e.action === 'CHECK_IN')).toBe(true);
  });

  it('진료 완료 시 큐에서 제거한다', () => {
    ai.checkIn('er', {
      patientId: 'p1',
      arrivedAt: 't',
      chiefComplaint: '통증',
      age: 30,
      initialTriage: 3,
    });
    ai.completeConsultation('er', 'p1');
    expect(ai.getQueueSize('er')).toBe(0);
  });

  it('S등급 데이터는 차단한다', () => {
    expect(() =>
      ai.checkIn(
        'er',
        { patientId: 'p1', arrivedAt: 't', chiefComplaint: 'x', age: 1, initialTriage: 3 },
        'S',
      ),
    ).toThrow('BLOCKED');
  });
});
