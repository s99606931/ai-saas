// 동적 도구 레지스트리 -- FR-ADV2.4
// Design Ref: SVC-AI-ADV-R2 DESIGN §3
// 테넌트별 커스텀 도구 등록/해제, 내장 도구 + 커스텀 도구 합산
// CSAP: D-08 접근 통제 (도구별 권한 검증), D-12 시스템 개발 보안

import { TOOL_DEFINITIONS, createToolExecutors } from './ai-tools.js';
import type { ToolDefinition, ToolExecutor } from './ai-tools.js';

// ── 타입 정의 ──────────────────────────────────────────────────────────────

export interface RegisteredTool {
  definition: ToolDefinition;
  executor: ToolExecutor;
  isBuiltin: boolean;
  registeredAt: number;
}

// ── Tool Registry ──────────────────────────────────────────────────────────

/**
 * 동적 Tool Registry
 * Plan SC: FR-ADV2.4
 *
 * 테넌트별 커스텀 도구를 런타임에 등록/해제할 수 있습니다.
 * 내장 도구(TOOL_DEFINITIONS)는 항상 포함되며, 커스텀 도구와 합산됩니다.
 */
export class ToolRegistry {
  private readonly tenantId: string;
  private readonly customTools = new Map<string, RegisteredTool>();
  private readonly builtinTools: Map<string, RegisteredTool>;

  constructor(tenantId: string, builtinExecutorOptions: Parameters<typeof createToolExecutors>[0] = {}) {
    this.tenantId = tenantId;

    // 내장 도구 등록
    const builtinExecutors = createToolExecutors(builtinExecutorOptions);
    this.builtinTools = new Map();

    for (const def of TOOL_DEFINITIONS) {
      const executor = builtinExecutors[def.name];
      if (executor) {
        this.builtinTools.set(def.name, {
          definition: def,
          executor,
          isBuiltin: true,
          registeredAt: Date.now(),
        });
      }
    }
  }

  /**
   * 커스텀 도구 등록
   * Plan SC: FR-ADV2.4
   *
   * @throws 내장 도구 이름과 충돌 시 오류
   */
  registerTool(tool: ToolDefinition, executor: ToolExecutor): void {
    // 내장 도구 이름 충돌 방지
    if (this.builtinTools.has(tool.name)) {
      throw new Error(`내장 도구 '${tool.name}'과 이름이 충돌합니다. 다른 이름을 사용하세요.`);
    }

    // 도구 이름 검증 (CSAP D-12: 입력 검증)
    if (!/^[a-z][a-z0-9_]{1,49}$/.test(tool.name)) {
      throw new Error(`도구 이름이 유효하지 않습니다: '${tool.name}'. 소문자 영문+숫자+밑줄, 2~50자`);
    }

    this.customTools.set(tool.name, {
      definition: tool,
      executor,
      isBuiltin: false,
      registeredAt: Date.now(),
    });
  }

  /**
   * 커스텀 도구 해제
   * Plan SC: FR-ADV2.4
   *
   * @returns 해제 성공 여부 (내장 도구는 해제 불가)
   */
  unregisterTool(name: string): boolean {
    if (this.builtinTools.has(name)) {
      return false; // 내장 도구는 해제 불가
    }
    return this.customTools.delete(name);
  }

  /**
   * 전체 도구 정의 목록 (내장 + 커스텀)
   */
  getTools(filter?: string[]): ToolDefinition[] {
    const allTools: ToolDefinition[] = [];

    for (const registered of this.builtinTools.values()) {
      if (!filter || filter.includes(registered.definition.name)) {
        allTools.push(registered.definition);
      }
    }

    for (const registered of this.customTools.values()) {
      if (!filter || filter.includes(registered.definition.name)) {
        allTools.push(registered.definition);
      }
    }

    return allTools;
  }

  /**
   * 전체 도구 실행기 맵 (내장 + 커스텀)
   */
  getExecutors(filter?: string[]): Record<string, ToolExecutor> {
    const executors: Record<string, ToolExecutor> = {};

    for (const [name, registered] of this.builtinTools) {
      if (!filter || filter.includes(name)) {
        executors[name] = registered.executor;
      }
    }

    for (const [name, registered] of this.customTools) {
      if (!filter || filter.includes(name)) {
        executors[name] = registered.executor;
      }
    }

    return executors;
  }

  /**
   * 도구 존재 확인
   */
  hasTool(name: string): boolean {
    return this.builtinTools.has(name) || this.customTools.has(name);
  }

  /**
   * 등록된 도구 수 (내장 + 커스텀)
   */
  get toolCount(): number {
    return this.builtinTools.size + this.customTools.size;
  }

  /**
   * 테넌트 ID
   */
  get tenant(): string {
    return this.tenantId;
  }
}

// ── 테넌트별 레지스트리 캐시 ────────────────────────────────────────────────

const registryCache = new Map<string, ToolRegistry>();
const REGISTRY_CACHE_MAX = 100;

/**
 * 테넌트별 Tool Registry 조회 또는 생성
 */
export function getOrCreateRegistry(
  tenantId: string,
  builtinExecutorOptions?: Parameters<typeof createToolExecutors>[0],
): ToolRegistry {
  const existing = registryCache.get(tenantId);
  if (existing) return existing;

  const registry = new ToolRegistry(tenantId, builtinExecutorOptions);

  // LRU 캐시 관리
  if (registryCache.size >= REGISTRY_CACHE_MAX) {
    const oldestKey = registryCache.keys().next().value;
    if (oldestKey !== undefined) {
      registryCache.delete(oldestKey);
    }
  }
  registryCache.set(tenantId, registry);
  return registry;
}

/**
 * 테넌트 레지스트리 초기화
 */
export function clearRegistry(tenantId: string): void {
  registryCache.delete(tenantId);
}
