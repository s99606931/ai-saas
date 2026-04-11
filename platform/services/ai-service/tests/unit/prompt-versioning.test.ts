// SVC-AI-ADV-R9 단위 테스트: 프롬프트 버전 관리
// Design Ref: SVC-AI-ADV-R9 DESIGN §2
// Plan SC: FR-ADV9.4, FR-ADV9.5
// CSAP: D-12, D-06

import { describe, it, expect, beforeEach } from 'vitest';
import {
  PromptVersionManager,
  createPromptVersionManager,
} from '../../src/lib/prompt-versioning.js';
import type { PromptVersion, ABTest } from '../../src/lib/prompt-versioning.js';

describe('PromptVersionManager 버전 생성 (FR-ADV9.4)', () => {
  let manager: PromptVersionManager;

  beforeEach(() => {
    manager = new PromptVersionManager();
  });

  it('새 프롬프트 버전을 생성한다', () => {
    const version = manager.createVersion('greeting', '안녕하세요, {{name}}님!');
    expect(version.name).toBe('greeting');
    expect(version.version).toBe(1);
    expect(version.template).toBe('안녕하세요, {{name}}님!');
    expect(version.status).toBe('draft');
  });

  it('버전 번호가 자동 증가한다', () => {
    manager.createVersion('greeting', 'v1');
    const v2 = manager.createVersion('greeting', 'v2');
    expect(v2.version).toBe(2);
  });

  it('변수를 자동 추출한다', () => {
    const version = manager.createVersion('test', '{{name}}님, {{date}}에 {{location}}에서 만나요');
    expect(version.variables).toContain('name');
    expect(version.variables).toContain('date');
    expect(version.variables).toContain('location');
    expect(version.variables).toHaveLength(3);
  });

  it('변수 없는 템플릿도 지원한다', () => {
    const version = manager.createVersion('static', '고정 프롬프트');
    expect(version.variables).toHaveLength(0);
  });

  it('메타데이터를 저장한다', () => {
    const version = manager.createVersion('test', '템플릿', { author: 'PM', purpose: '테스트' });
    expect(version.metadata['author']).toBe('PM');
  });

  it('UUID 형식의 id를 생성한다', () => {
    const version = manager.createVersion('test', '템플릿');
    expect(version.id).toBeDefined();
    expect(version.id.length).toBeGreaterThan(0);
  });
});

describe('PromptVersionManager 활성화/아카이브', () => {
  let manager: PromptVersionManager;

  beforeEach(() => {
    manager = new PromptVersionManager();
  });

  it('버전을 활성화한다', () => {
    const v1 = manager.createVersion('greeting', 'v1');
    const activated = manager.activateVersion(v1.id);
    expect(activated.status).toBe('active');
    expect(activated.activatedAt).toBeDefined();
  });

  it('새 버전 활성화 시 이전 활성 버전은 아카이브된다', () => {
    const v1 = manager.createVersion('greeting', 'v1');
    manager.activateVersion(v1.id);
    const v2 = manager.createVersion('greeting', 'v2');
    manager.activateVersion(v2.id);

    const active = manager.getActiveVersion('greeting');
    expect(active?.version).toBe(2);
    // v1은 아카이브
    const history = manager.getVersionHistory('greeting');
    const v1Status = history.find((v) => v.version === 1);
    expect(v1Status?.status).toBe('archived');
  });

  it('활성 버전을 조회한다', () => {
    const v1 = manager.createVersion('greeting', 'v1');
    manager.activateVersion(v1.id);
    const active = manager.getActiveVersion('greeting');
    expect(active).toBeDefined();
    expect(active?.name).toBe('greeting');
  });

  it('활성 버전이 없으면 null을 반환한다', () => {
    const active = manager.getActiveVersion('nonexistent');
    expect(active).toBeNull();
  });

  it('버전을 아카이브한다', () => {
    const v1 = manager.createVersion('test', 'v1');
    manager.activateVersion(v1.id);
    manager.archiveVersion(v1.id);
    const active = manager.getActiveVersion('test');
    expect(active).toBeNull();
  });

  it('존재하지 않는 버전 활성화 시 에러를 발생한다', () => {
    expect(() => manager.activateVersion('nonexistent-id')).toThrow();
  });
});

describe('PromptVersionManager 버전 이력', () => {
  it('이름별 전체 버전 이력을 반환한다', () => {
    const manager = new PromptVersionManager();
    manager.createVersion('greeting', 'v1');
    manager.createVersion('greeting', 'v2');
    manager.createVersion('greeting', 'v3');

    const history = manager.getVersionHistory('greeting');
    expect(history).toHaveLength(3);
    // 최신 먼저
    expect(history[0]?.version).toBe(3);
    expect(history[2]?.version).toBe(1);
  });

  it('다른 이름의 버전은 포함하지 않는다', () => {
    const manager = new PromptVersionManager();
    manager.createVersion('greeting', 'v1');
    manager.createVersion('farewell', 'v1');

    const greetingHistory = manager.getVersionHistory('greeting');
    expect(greetingHistory).toHaveLength(1);
  });
});

describe('PromptVersionManager 렌더링', () => {
  let manager: PromptVersionManager;

  beforeEach(() => {
    manager = new PromptVersionManager();
    const v = manager.createVersion('greeting', '안녕하세요, {{name}}님! {{date}} 방문을 환영합니다.');
    manager.activateVersion(v.id);
  });

  it('변수를 치환하여 렌더링한다', () => {
    const result = manager.render('greeting', { name: '홍길동', date: '2026-04-11' });
    expect(result.text).toBe('안녕하세요, 홍길동님! 2026-04-11 방문을 환영합니다.');
  });

  it('렌더링 결과에 versionId가 포함된다', () => {
    const result = manager.render('greeting', { name: '테스트' });
    expect(result.versionId).toBeDefined();
    expect(result.version).toBe(1);
  });

  it('누락된 변수는 원본 패턴을 유지한다', () => {
    const result = manager.render('greeting', { name: '홍길동' });
    expect(result.text).toContain('{{date}}');
  });

  it('활성 버전 없으면 에러를 발생한다', () => {
    expect(() => manager.render('nonexistent', {})).toThrow('활성 프롬프트를 찾을 수 없습니다');
  });
});

describe('PromptVersionManager A/B 테스트 (FR-ADV9.5)', () => {
  let manager: PromptVersionManager;
  let v1Id: string;
  let v2Id: string;

  beforeEach(() => {
    manager = new PromptVersionManager();
    const v1 = manager.createVersion('greeting', '간단 인사: {{name}}');
    const v2 = manager.createVersion('greeting', '정중한 인사: {{name}}님 환영합니다');
    v1Id = v1.id;
    v2Id = v2.id;
    manager.activateVersion(v1.id);
  });

  it('A/B 테스트를 생성한다', () => {
    const test = manager.createABTest('인사 비교', 'greeting', [
      { promptVersionId: v1Id, weight: 0.5 },
      { promptVersionId: v2Id, weight: 0.5 },
    ]);
    expect(test.status).toBe('running');
    expect(test.variants).toHaveLength(2);
  });

  it('가중치 합계가 1.0이 아니면 에러를 발생한다', () => {
    expect(() => manager.createABTest('잘못된 테스트', 'greeting', [
      { promptVersionId: v1Id, weight: 0.3 },
      { promptVersionId: v2Id, weight: 0.3 },
    ])).toThrow('가중치');
  });

  it('A/B 테스트 실행 중 render는 변형을 선택한다', () => {
    manager.createABTest('인사 비교', 'greeting', [
      { promptVersionId: v1Id, weight: 0.5 },
      { promptVersionId: v2Id, weight: 0.5 },
    ]);

    const result = manager.render('greeting', { name: '테스트' });
    expect(result.abTestId).toBeDefined();
    expect(result.text).toBeDefined();
  });

  it('A/B 테스트를 완료하고 승자를 결정한다', () => {
    const test = manager.createABTest('인사 비교', 'greeting', [
      { promptVersionId: v1Id, weight: 0.5 },
      { promptVersionId: v2Id, weight: 0.5 },
    ]);

    // 결과 기록 (impressions를 먼저 올려야 이동 평균이 동작)
    manager.render('greeting', { name: '사용자1' }); // impression++
    manager.recordABTestResult(test.id, v1Id, { latencyMs: 100, tokens: 50, satisfaction: 0.9 });
    manager.render('greeting', { name: '사용자2' }); // impression++
    manager.recordABTestResult(test.id, v2Id, { latencyMs: 200, tokens: 100, satisfaction: 0.7 });

    const completed = manager.completeABTest(test.id);
    expect(completed.status).toBe('completed');
    expect(completed.winnerId).toBeDefined();
  });

  it('존재하지 않는 테스트 완료 시 에러를 발생한다', () => {
    expect(() => manager.completeABTest('nonexistent')).toThrow();
  });
});

describe('createPromptVersionManager 팩토리', () => {
  it('PromptVersionManager 인스턴스를 생성한다', () => {
    const manager = createPromptVersionManager();
    expect(manager).toBeInstanceOf(PromptVersionManager);
  });
});
