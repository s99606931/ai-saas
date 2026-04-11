// SVC-AI-ADV-R2 단위 테스트: 동적 Tool Registry
// Design Ref: SVC-AI-ADV-R2 DESIGN §3
// Plan SC: FR-ADV2.4
// CSAP: D-08, D-12

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ToolRegistry,
  getOrCreateRegistry,
  clearRegistry,
} from '../../src/lib/tool-registry.js';
import type { ToolDefinition, ToolExecutor } from '../../src/lib/ai-tools.js';

// 테스트용 도구
const testTool: ToolDefinition = {
  name: 'custom_test_tool',
  description: '테스트용 커스텀 도구',
  parameters: {
    input: { type: 'string', description: '입력', required: true },
  },
};

const testExecutor: ToolExecutor = async (params) => ({
  success: true,
  output: `실행 결과: ${String(params['input'] ?? '')}`,
});

describe('ToolRegistry (FR-ADV2.4)', () => {
  describe('registerTool', () => {
    it('커스텀 도구를 등록할 수 있다', () => {
      const registry = new ToolRegistry('tenant-1');
      registry.registerTool(testTool, testExecutor);
      expect(registry.hasTool('custom_test_tool')).toBe(true);
    });

    it('내장 도구 이름과 충돌 시 오류를 발생시킨다', () => {
      const registry = new ToolRegistry('tenant-1');
      const conflictTool: ToolDefinition = {
        name: 'search_knowledge',
        description: '충돌 도구',
        parameters: {},
      };
      expect(() => registry.registerTool(conflictTool, testExecutor)).toThrow('충돌');
    });

    it('유효하지 않은 도구 이름은 거부한다 (CSAP D-12)', () => {
      const registry = new ToolRegistry('tenant-1');
      const invalidTool: ToolDefinition = {
        name: 'INVALID-NAME!',
        description: '잘못된 이름',
        parameters: {},
      };
      expect(() => registry.registerTool(invalidTool, testExecutor)).toThrow('유효하지 않습니다');
    });

    it('소문자 영문+숫자+밑줄 2~50자만 허용한다', () => {
      const registry = new ToolRegistry('tenant-1');
      const validTool: ToolDefinition = {
        name: 'my_valid_tool_01',
        description: '유효한 이름',
        parameters: {},
      };
      expect(() => registry.registerTool(validTool, testExecutor)).not.toThrow();
    });

    it('한 글자 도구 이름은 거부한다', () => {
      const registry = new ToolRegistry('tenant-1');
      const shortTool: ToolDefinition = {
        name: 'a',
        description: '너무 짧은 이름',
        parameters: {},
      };
      expect(() => registry.registerTool(shortTool, testExecutor)).toThrow();
    });
  });

  describe('unregisterTool', () => {
    it('커스텀 도구를 해제할 수 있다', () => {
      const registry = new ToolRegistry('tenant-1');
      registry.registerTool(testTool, testExecutor);
      const result = registry.unregisterTool('custom_test_tool');
      expect(result).toBe(true);
      expect(registry.hasTool('custom_test_tool')).toBe(false);
    });

    it('내장 도구는 해제할 수 없다', () => {
      const registry = new ToolRegistry('tenant-1');
      const result = registry.unregisterTool('search_knowledge');
      expect(result).toBe(false);
    });

    it('존재하지 않는 도구 해제 시 false를 반환한다', () => {
      const registry = new ToolRegistry('tenant-1');
      const result = registry.unregisterTool('nonexistent');
      expect(result).toBe(false);
    });
  });

  describe('getTools', () => {
    it('내장 도구 + 커스텀 도구를 모두 반환한다', () => {
      const registry = new ToolRegistry('tenant-1');
      registry.registerTool(testTool, testExecutor);
      const tools = registry.getTools();
      expect(tools.some((t) => t.name === 'custom_test_tool')).toBe(true);
      expect(tools.some((t) => t.name === 'search_knowledge')).toBe(true);
    });

    it('필터를 적용하면 지정된 도구만 반환한다', () => {
      const registry = new ToolRegistry('tenant-1');
      registry.registerTool(testTool, testExecutor);
      const filtered = registry.getTools(['custom_test_tool']);
      expect(filtered).toHaveLength(1);
      expect(filtered[0]?.name).toBe('custom_test_tool');
    });
  });

  describe('getExecutors', () => {
    it('전체 실행기 맵을 반환한다', () => {
      const registry = new ToolRegistry('tenant-1');
      registry.registerTool(testTool, testExecutor);
      const executors = registry.getExecutors();
      expect(executors['custom_test_tool']).toBeDefined();
    });

    it('필터를 적용하면 지정된 실행기만 반환한다', () => {
      const registry = new ToolRegistry('tenant-1');
      registry.registerTool(testTool, testExecutor);
      const executors = registry.getExecutors(['custom_test_tool']);
      expect(Object.keys(executors)).toHaveLength(1);
    });
  });

  describe('hasTool', () => {
    it('내장 도구 존재를 확인한다', () => {
      const registry = new ToolRegistry('tenant-1');
      expect(registry.hasTool('search_knowledge')).toBe(true);
    });

    it('미등록 도구는 false를 반환한다', () => {
      const registry = new ToolRegistry('tenant-1');
      expect(registry.hasTool('nonexistent')).toBe(false);
    });
  });

  describe('toolCount', () => {
    it('내장 + 커스텀 도구 수를 반환한다', () => {
      const registry = new ToolRegistry('tenant-1');
      const initialCount = registry.toolCount;
      registry.registerTool(testTool, testExecutor);
      expect(registry.toolCount).toBe(initialCount + 1);
    });
  });

  describe('tenant', () => {
    it('테넌트 ID를 반환한다', () => {
      const registry = new ToolRegistry('tenant-123');
      expect(registry.tenant).toBe('tenant-123');
    });
  });
});

describe('테넌트별 레지스트리 캐시', () => {
  beforeEach(() => {
    clearRegistry('tenant-1');
    clearRegistry('tenant-2');
  });

  describe('getOrCreateRegistry', () => {
    it('테넌트별 레지스트리를 생성한다', () => {
      const registry = getOrCreateRegistry('tenant-1');
      expect(registry).toBeDefined();
      expect(registry.tenant).toBe('tenant-1');
    });

    it('같은 테넌트 레지스트리를 재사용한다', () => {
      const r1 = getOrCreateRegistry('tenant-1');
      const r2 = getOrCreateRegistry('tenant-1');
      expect(r1).toBe(r2);
    });

    it('다른 테넌트 레지스트리는 분리된다 (N2SF N-03)', () => {
      const r1 = getOrCreateRegistry('tenant-1');
      const r2 = getOrCreateRegistry('tenant-2');
      expect(r1).not.toBe(r2);
    });
  });

  describe('clearRegistry', () => {
    it('테넌트 레지스트리를 무효화한다', () => {
      const r1 = getOrCreateRegistry('tenant-1');
      clearRegistry('tenant-1');
      const r2 = getOrCreateRegistry('tenant-1');
      expect(r1).not.toBe(r2);
    });
  });
});
