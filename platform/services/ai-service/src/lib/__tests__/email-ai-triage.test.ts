import { describe, it, expect, beforeEach } from 'vitest';
import { EmailAiTriage, type Email } from '../email-ai-triage';

describe('EmailAiTriage', () => {
  let svc: EmailAiTriage;

  beforeEach(() => {
    svc = new EmailAiTriage();
    svc.addTemplate({ id: 't1', category: 'complaint', subject: '민원 접수', body: '안녕하세요, 민원이 접수되었습니다.' });
    svc.addTemplate({ id: 't2', category: 'inquiry', subject: '문의 답변', body: '안녕하세요, 문의하신 내용입니다.' });
  });

  it('FR-EM.1 분류 (민원)', () => {
    const email: Email = { id: 'e1', subject: '민원 신고', body: '시설 불만 있습니다', sender: 'a@x.kr', attachments: [] };
    const c = svc.classify(email);
    expect(c.category).toBe('complaint');
  });

  it('FR-EM.2 우선순위', () => {
    const email: Email = { id: 'e2', subject: '스팸 당첨', body: 'lottery 당첨', sender: 's@x', attachments: [] };
    const c = svc.classify(email);
    expect(c.priority).toBe(0);
  });

  it('FR-EM.3 템플릿 매칭', () => {
    const email: Email = { id: 'e3', subject: '문의', body: '궁금한 점', sender: 'x', attachments: [] };
    const c = svc.classify(email);
    const t = svc.matchTemplate(c);
    expect(t?.id).toBe('t2');
  });

  it('FR-EM.4 첨부 스캔', () => {
    const email: Email = {
      id: 'e4',
      subject: '첨부',
      body: '첨부',
      sender: 'x',
      attachments: [{ name: 'malware.exe', sizeBytes: 1000 }],
    };
    const w = svc.scanAttachments(email);
    expect(w.length).toBeGreaterThan(0);
  });

  it('FR-EM.5 트리아지 (승인 필요)', () => {
    const email: Email = { id: 'e5', subject: '민원', body: '민원입니다', sender: 'x', attachments: [] };
    const r = svc.triage(email);
    expect(r.requiresApproval).toBe(true);
  });
});
