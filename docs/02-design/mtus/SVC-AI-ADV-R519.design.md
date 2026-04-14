# SVC-AI-ADV-R519 Design — service-dependency-doc-automator-v3.ts

Plan Ref: SVC-AI-ADV-R519.plan.md

```ts
export interface ServiceDep {
  readonly serviceId: string;
  readonly name: string;
  readonly dependsOn: readonly string[];
}
export interface DepAnalysis {
  readonly serviceId: string;
  readonly depth: number;        // BFS depth from roots (no dependsOn)
  readonly impactedBy: number;   // count of services that depend on this
  readonly hasCycle: boolean;
}
export interface DependencyReport {
  readonly services: readonly DepAnalysis[];
  readonly hasCycles: boolean;
  readonly cycleServices: readonly string[];
}
```

depth: BFS from services with no dependsOn (root=0)
impactedBy: count services that list this serviceId in dependsOn
hasCycle: DFS with visited/stack sets
