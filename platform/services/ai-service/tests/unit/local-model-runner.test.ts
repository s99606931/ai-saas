// SVC-AI-ADV-R38 단위 테스트: 로컬 모델 실행기 (순수 로직)
// Design Ref: SVC-AI-ADV-R38 DESIGN §1, §6
// Plan SC: FR-ADV38.1 (Ollama 연동), FR-ADV38.4 (스트리밍)
// CSAP: D-09 전송 보안, N2SF 로컬 전용 처리

import { describe, it, expect, afterEach } from 'vitest';

import {
  LocalModelRunner,
  getLocalModelRunner,
  resetLocalModelRunner,
} from '../../src/lib/local-model-runner.js';

// -- 생성자 및 기본 설정 --------------------------------------------------------

describe('LocalModelRunner 생성', () => {
  it('기본 설정으로 생성한다', () => {
    const runner = new LocalModelRunner();
    // 에러 없이 인스턴스 생성 확인
    expect(runner).toBeInstanceOf(LocalModelRunner);
  });

  it('사용자 정의 설정으로 생성한다', () => {
    const runner = new LocalModelRunner({
      baseUrl: 'http://custom:1234',
      timeout: 60000,
    });
    expect(runner).toBeInstanceOf(LocalModelRunner);
  });
});

// -- 메트릭 관리 -- Design §6 ---------------------------------------------------

describe('LocalModelRunner 메트릭', () => {
  it('초기 메트릭은 빈 배열', () => {
    const runner = new LocalModelRunner();
    expect(runner.getMetrics()).toHaveLength(0);
  });

  it('초기 성능 요약은 0', () => {
    const runner = new LocalModelRunner();
    const summary = runner.getPerformanceSummary();
    expect(summary.avgTokensPerSecond).toBe(0);
    expect(summary.avgLatencyMs).toBe(0);
    expect(summary.totalInferences).toBe(0);
  });

  it('getMetrics에 limit를 지정한다', () => {
    const runner = new LocalModelRunner();
    // 메트릭이 없으므로 빈 배열
    const metrics = runner.getMetrics(5);
    expect(metrics).toHaveLength(0);
  });
});

// -- 팩토리 ------------------------------------------------------------------

describe('LocalModelRunner 팩토리', () => {
  afterEach(() => {
    resetLocalModelRunner();
  });

  it('싱글턴 인스턴스를 반환한다', () => {
    const r1 = getLocalModelRunner();
    const r2 = getLocalModelRunner();
    expect(r1).toBe(r2);
  });

  it('리셋 후 새 인스턴스를 생성한다', () => {
    const r1 = getLocalModelRunner();
    resetLocalModelRunner();
    const r2 = getLocalModelRunner();
    expect(r1).not.toBe(r2);
  });
});
