import { describe, it, expect, beforeEach } from 'vitest';
import { PublicComplaintClassifierV3, type Complaint } from '../public-complaint-classifier-v3';

describe('PublicComplaintClassifierV3', () => {
  let classifier: PublicComplaintClassifierV3;

  beforeEach(() => {
    classifier = new PublicComplaintClassifierV3();
  });

  it('classifies traffic-related complaint as TRAFFIC', () => {
    const complaints: Complaint[] = [
      { complaintId: 'C1', content: '도로 포장이 불량합니다', submitterId: 'user1234', urgency: 'normal' },
    ];
    const result = classifier.classify_complaints(complaints);
    expect(result[0]!.category).toBe('TRAFFIC');
  });

  it('classifies environment-related complaint as ENVIRONMENT', () => {
    const complaints: Complaint[] = [
      { complaintId: 'C2', content: '쓰레기 무단 투기 문제', submitterId: 'user5678', urgency: 'high' },
    ];
    const result = classifier.classify_complaints(complaints);
    expect(result[0]!.category).toBe('ENVIRONMENT');
  });

  it('classifies safety-related complaint as SAFETY', () => {
    const complaints: Complaint[] = [
      { complaintId: 'C3', content: '화재 위험 구역 발견', submitterId: 'user9012', urgency: 'emergency' },
    ];
    const result = classifier.classify_complaints(complaints);
    expect(result[0]!.category).toBe('SAFETY');
  });

  it('classifies unrecognized complaint as OTHER', () => {
    const complaints: Complaint[] = [
      { complaintId: 'C4', content: '기타 민원 사항입니다', submitterId: 'user3456', urgency: 'low' },
    ];
    const result = classifier.classify_complaints(complaints);
    expect(result[0]!.category).toBe('OTHER');
  });

  it('assigns priority 1 for emergency urgency', () => {
    const complaints: Complaint[] = [
      { complaintId: 'C5', content: '긴급 사항', submitterId: 'userABCD', urgency: 'emergency' },
    ];
    const result = classifier.classify_complaints(complaints);
    expect(result[0]!.priority).toBe(1);
  });

  it('masks submitterId correctly', () => {
    const complaints: Complaint[] = [
      { complaintId: 'C6', content: '소음 문제', submitterId: 'user9999', urgency: 'normal' },
    ];
    const result = classifier.classify_complaints(complaints);
    // 'user9999' len=8: 'us' + '****' + '99'
    expect(result[0]!.maskedSubmitterId).toBe('us****99');
  });

  it('records audit log', () => {
    classifier.classify_complaints([
      { complaintId: 'C7', content: '테스트', submitterId: 'testUser', urgency: 'low' },
    ]);
    const log = classifier.getAuditLog();
    expect(log[0]!.action).toBe('complaint.classify');
  });
});
