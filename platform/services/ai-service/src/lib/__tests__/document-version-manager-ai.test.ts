import { describe, it, expect, beforeEach } from 'vitest';
import { DocumentVersionManagerAI } from '../document-version-manager-ai';

describe('DocumentVersionManagerAI', () => {
  let manager: DocumentVersionManagerAI;

  beforeEach(() => {
    manager = new DocumentVersionManagerAI();
  });

  it('문서를 생성하고 버전 1이 할당된다', () => {
    manager.createDocument('doc-1', '공고문', '내용A', '작성자1');
    const history = manager.getHistory('doc-1');
    expect(history.length).toBe(1);
    expect(history[0]!.version).toBe(1);
  });

  it('버전을 추가 생성한다', () => {
    manager.createDocument('doc-1', '공고문', '내용A', '작성자1');
    const v2 = manager.createVersion('doc-1', '내용B', '작성자2', '수정');
    expect(v2).toBe(2);
    expect(manager.getHistory('doc-1').length).toBe(2);
  });

  it('이미 존재하는 문서 생성 시 오류를 던진다', () => {
    manager.createDocument('doc-1', '공고문', '내용A', '작성자1');
    expect(() => manager.createDocument('doc-1', '공고문2', '내용B', '작성자2')).toThrow('이미 존재');
  });

  it('버전 간 diff를 반환한다', () => {
    manager.createDocument('doc-1', '공고문', '라인1\n라인2\n라인3', '작성자');
    manager.createVersion('doc-1', '라인1\n라인3\n라인4', '작성자', '수정');
    const diff = manager.getDiff('doc-1', 1, 2);
    expect(diff.removed).toContain('라인2');
    expect(diff.added).toContain('라인4');
  });

  it('특정 버전으로 롤백하면 새 버전이 생성된다', () => {
    manager.createDocument('doc-1', '공고문', '원본', '작성자');
    manager.createVersion('doc-1', '수정본', '작성자', '수정');
    const result = manager.rollback('doc-1', 1);
    expect(result.rolledBackTo).toBe(1);
    expect(result.newVersion).toBe(3);
    const latest = manager.getHistory('doc-1')[0]!;
    expect(latest.content).toBe('원본');
  });

  it('이력이 버전 내림차순으로 반환된다', () => {
    manager.createDocument('doc-1', '문서', '내용1', '작성자');
    manager.createVersion('doc-1', '내용2', '작성자', '수정');
    manager.createVersion('doc-1', '내용3', '작성자', '수정');
    const history = manager.getHistory('doc-1');
    expect(history[0]!.version).toBe(3);
    expect(history[2]!.version).toBe(1);
  });

  it('C등급 데이터 전송을 차단한다', () => {
    expect(() => manager.createDocument('doc-1', '공고문', '내용', '작성자', 'C' as never)).toThrow('BLOCKED');
  });

  it('감사 로그가 기록된다', () => {
    manager.createDocument('doc-1', '문서', '내용', '작성자');
    expect(manager.getAuditLog().length).toBeGreaterThanOrEqual(1);
  });
});
