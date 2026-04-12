// MTU-N328 음성 텍스트 변환 어댑터 테스트
import { describe, it, expect } from 'vitest';
import { SpeechToTextAdapterService } from '../speech-to-text-adapter.js';

describe('MTU-N328 SpeechToTextAdapter', () => {
  const svc = new SpeechToTextAdapterService('tenant-n328');

  it('FR-N328.1: 메타데이터 파싱', () => {
    const md = svc.parseMetadata('f1', 'meeting.wav', 600);
    expect(md).toBeDefined();
  });

  it('FR-N328.2: 화자 세그먼트', () => {
    const seg = svc.segment('speaker1', 0, 10, '안녕하세요');
    expect(seg).toBeDefined();
  });

  it('FR-N328.3: 전사 생성', () => {
    const md = svc.parseMetadata('f1', 'test.wav', 30);
    const segs = [
      svc.segment('s1', 0, 10, '첫 발화'),
      svc.segment('s2', 10, 20, '두 번째 발화'),
    ];
    const result = svc.transcribe(md, segs);
    expect(result).toBeDefined();
  });

  it('FR-N328.6: 감사 로그', () => {
    expect(svc.getAuditLog().length).toBeGreaterThan(0);
  });
});
