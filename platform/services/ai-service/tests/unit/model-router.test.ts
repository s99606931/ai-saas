// 모델 라우터 유닛 테스트
// Design Ref: SVC-AI-R3 DESIGN §3 FR-AI-R3.3

import { describe, it, expect } from 'vitest';
import { modelRouter } from '../../src/lib/model-router.js';

describe('FR-AI-R3.3: 스마트 모델 라우팅', () => {
  describe('classifyModelType', () => {
    it('임베딩 모델을 embed로 분류한다', () => {
      expect(modelRouter.classifyModelType('text-embedding-nomic-embed-text-v1.5')).toBe('embed');
      expect(modelRouter.classifyModelType('text-embedding-qwen3-embedding-0.6b')).toBe('embed');
      expect(modelRouter.classifyModelType('bge-m3')).toBe('embed');
    });

    it('비전 모델을 multimodal로 분류한다', () => {
      expect(modelRouter.classifyModelType('llava-v1.6-mistral-7b')).toBe('multimodal');
      expect(modelRouter.classifyModelType('gemma-4-e4b-it')).toBe('multimodal');
    });

    it('일반 텍스트 모델을 chat으로 분류한다', () => {
      expect(modelRouter.classifyModelType('google/gemma-4-26b-a4b')).toBe('chat');
      expect(modelRouter.classifyModelType('qwen/qwen3.5-9b')).toBe('chat');
      expect(modelRouter.classifyModelType('gemma-4-e4b-it')).not.toBe('chat');
    });
  });

  describe('selectModel', () => {
    const models = [
      'google/gemma-4-26b-a4b',
      'text-embedding-nomic-embed-text-v1.5',
      'llava-v1.6-mistral-7b',
    ];

    it('chat 요청 시 chat 모델을 반환한다', () => {
      const selected = modelRouter.selectModel('chat', models, 'default-model');
      expect(selected).toBe('google/gemma-4-26b-a4b');
    });

    it('embed 요청 시 임베딩 모델을 반환한다', () => {
      const selected = modelRouter.selectModel('embed', models, 'default-model');
      expect(selected).toBe('text-embedding-nomic-embed-text-v1.5');
    });

    it('multimodal 요청 시 비전 모델을 반환한다', () => {
      const selected = modelRouter.selectModel('multimodal', models, 'default-model');
      expect(selected).toBe('llava-v1.6-mistral-7b');
    });

    it('적합한 모델이 없으면 기본값을 반환한다', () => {
      const selected = modelRouter.selectModel('embed', ['google/gemma-4-26b-a4b'], 'fallback-model');
      expect(selected).toBe('fallback-model');
    });
  });
});
