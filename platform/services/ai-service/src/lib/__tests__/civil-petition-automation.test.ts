// MTU-N283 민원 처리 자동화 테스트
import { describe, it, expect } from 'vitest';
import { CivilPetitionAutomationService } from '../civil-petition-automation.js';

describe('MTU-N283 CivilPetitionAutomation', () => {
  const svc = new CivilPetitionAutomationService('tenant-n283');

  it('FR-N283.1: 민원 접수', () => {
    const intake = svc.receive('online_portal', '도로 파손 신고합니다', '홍길동', '010-1111-2222');
    expect(intake.petitionId).toBeDefined();
    expect(intake.subject).toBeDefined();
  });

  it('FR-N283.2: 자동 분류', () => {
    const intake = svc.receive('online_portal', '교통신호 고장', '김민원', '01099998888');
    const cls = svc.classify(intake);
    expect(cls.category).toBeDefined();
    expect(cls.priority).toBeDefined();
  });

  it('FR-N283.3: 담당자 배정', () => {
    const intake = svc.receive('phone', '복지 문의', '이민원', '01077776666');
    const cls = svc.classify(intake);
    const a = svc.assign(intake.petitionId, cls);
    expect(a.assignedTo).toBeDefined();
  });

  it('FR-N283.4: 회신 초안 생성', () => {
    const intake = svc.receive('email', '민원회신 테스트', '박민원', 'a@b.co');
    const cls = svc.classify(intake);
    const r = svc.generateReply(intake.petitionId, cls.category, '처리 완료');
    expect(r.body).toBeDefined();
  });

  it('FR-N283.5: SLA 확인', () => {
    const intake = svc.receive('online_portal', 'SLA 테스트', '최민원', '010-2222-3333');
    const cls = svc.classify(intake);
    const sla = svc.checkSLA(intake.petitionId, cls.category, new Date().toISOString());
    expect(typeof sla.maxProcessingDays).toBe('number');
  });

  it('FR-N283.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
