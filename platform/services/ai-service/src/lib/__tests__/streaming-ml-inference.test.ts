import { describe, it, expect } from 'vitest';
import { StreamingMlInferencePipeline } from '../streaming-ml-inference.js';

describe('StreamingMlInferencePipeline', () => {
  const inferenceFn = async (batch: Array<{ x: number }>) => batch.map((b) => ({ y: b.x * 2 }));

  it('배치 추론', async () => {
    const pipe = new StreamingMlInferencePipeline(inferenceFn, {
      batchSize: 3,
      maxQueueSize: 100,
      flushIntervalMs: 100,
    });
    pipe.enqueue({ id: '1', timestamp: '2026-04-12', payload: { x: 1 } });
    pipe.enqueue({ id: '2', timestamp: '2026-04-12', payload: { x: 2 } });
    pipe.enqueue({ id: '3', timestamp: '2026-04-12', payload: { x: 3 } });
    const results = await pipe.flush();
    expect(results).toHaveLength(3);
    expect(results[0]?.result).toEqual({ y: 2 });
  });

  it('큐 오버플로우 드롭', () => {
    const pipe = new StreamingMlInferencePipeline(inferenceFn, {
      batchSize: 10,
      maxQueueSize: 2,
      flushIntervalMs: 100,
    });
    expect(pipe.enqueue({ id: '1', timestamp: 't', payload: { x: 1 } })).toBe(true);
    expect(pipe.enqueue({ id: '2', timestamp: 't', payload: { x: 2 } })).toBe(true);
    expect(pipe.enqueue({ id: '3', timestamp: 't', payload: { x: 3 } })).toBe(false);
  });

  it('결과 리스너 호출', async () => {
    const pipe = new StreamingMlInferencePipeline(inferenceFn, {
      batchSize: 5,
      maxQueueSize: 100,
      flushIntervalMs: 100,
    });
    const seen: string[] = [];
    pipe.onResult((out) => seen.push(out.eventId));
    pipe.enqueue({ id: 'a', timestamp: 't', payload: { x: 1 } });
    await pipe.flush();
    expect(seen).toEqual(['a']);
  });

  it('메트릭 수집', async () => {
    const pipe = new StreamingMlInferencePipeline(inferenceFn, {
      batchSize: 2,
      maxQueueSize: 100,
      flushIntervalMs: 100,
    });
    pipe.enqueue({ id: '1', timestamp: 't', payload: { x: 1 } });
    pipe.enqueue({ id: '2', timestamp: 't', payload: { x: 2 } });
    await pipe.flush();
    expect(pipe.metrics().processed).toBe(2);
  });

  it('잘못된 배치 크기', () => {
    expect(
      () => new StreamingMlInferencePipeline(inferenceFn, { batchSize: 0, maxQueueSize: 10, flushIntervalMs: 10 }),
    ).toThrow('PIPELINE_INVALID_BATCH');
  });
});
