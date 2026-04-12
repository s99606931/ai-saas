# SVC-AI-ADV-R76 — Agent Dry-Run Simulator (Design)

> **PDCA**: Design | **버전**: 1.0.0 | **작성일**: 2026-04-12 | **작성자**: PM Lead

## Executive Summary

에이전트 계획(Plan)이 실제 시스템에 쓰기·호출을 가하기 전에 가상 실행하여 side-effect, 위험도, 비용을 사전 평가한다. 기존 `policy-simulator.ts`는 정책 영향 평가용이고, 본 모듈은 **에이전트 도구 호출 단위** 드라이런을 전담한다.

## 아키텍처 옵션

1. **Tool Registry 기반 정적 분석**: 도구 메타데이터로만 추정. 단순하나 동적 분기 대응 못함.
2. **Pragmatic Balance (채택)**: 도구 레지스트리 + 가상 실행 훅 + 분기 추적. 쓰기/네트워크/삭제 시 즉시 차단.
3. **전체 샌드박스 재현**: 컨테이너 격리 실행. 리소스 과다.

## 모듈 구조 (§3.1)

```ts
export type SideEffectKind = 'read' | 'write' | 'network' | 'delete' | 'exec';

export interface ToolMeta {
  name: string;
  sideEffects: SideEffectKind[];
  riskWeight: number; // 0~1
  grade?: 'O' | 'C' | 'S';
}

export interface DryRunStep {
  stepId: string;
  tool: string;
  args: Record<string, unknown>;
}

export interface DryRunReport {
  simId: string;
  totalSteps: number;
  effects: Record<SideEffectKind, number>;
  riskScore: number;
  highRiskSteps: string[];
  blocked: boolean;
  durationMs: number;
}
```

## 핵심 알고리즘 (§3.2)

1. Plan 파싱 → 단계 검증 (알려지지 않은 도구 탐지)
2. 각 단계를 ToolMeta에 매핑 → side-effect 누적
3. 쓰기/삭제/네트워크 가중치 합산 → riskScore (0~1)
4. riskScore ≥ 0.7 → 고위험 플래그
5. C/S 등급 도구 호출 포함 시 즉시 BLOCKED
6. audit 이벤트: `SIMULATE`, `RISK_HIGH`, `BLOCKED`

## 감사 로그 연동 (§3.3)

- actor: system, action: AGENT_DRY_RUN, target: simId
- CSAP D-06 append-only
- grade 필드에 N2SF 등급 기록

## Session Guide

- 구현: `platform/services/ai-service/src/lib/agent-dry-run-simulator.ts`
- 테스트: `__tests__/agent-dry-run-simulator.test.ts`
- Plan SC: FR-R76.1~5

## Design Anchor

- `policy-simulator.ts`(정책 변경 영향) ≠ `agent-dry-run-simulator.ts`(도구 호출 예측)
- `ai-sandbox-execution.ts`(실제 격리 실행) ≠ 본 모듈(가상 실행, 부작용 없음)
- Plan FR-R76.1~5 1:1 매핑
