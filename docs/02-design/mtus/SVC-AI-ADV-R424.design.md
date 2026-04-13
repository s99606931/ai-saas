# SVC-AI-ADV-R424 Design — Environmental Impact Assessor

Plan Ref: SVC-AI-ADV-R424.plan.md

## 인터페이스
```ts
export interface ProjectEnv {
  readonly projectId: string;
  readonly emissionsTon: number;
  readonly noiseDb: number;
  readonly wastewaterTon: number;
}
export type Grade = 'A' | 'B' | 'C' | 'D' | 'E';
export interface ImpactResult {
  readonly projectId: string;
  readonly ghgScore: number;
  readonly noiseScore: number;
  readonly waterScore: number;
  readonly totalImpact: number;
  readonly grade: Grade;
}
```

## 알고리즘
- ghg = clip(emissionsTon*2, 0, 100)
- noise = clip((dB-40)*2, 0, 100)
- water = clip(wastewaterTon*5, 0, 100)
- totalImpact = ghg*0.5 + noise*0.2 + water*0.3
- grade 분기
