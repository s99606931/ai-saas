# SVC-AI-ADV-R451 Design — 교통 혼잡 예측 AI

Plan Ref: SVC-AI-ADV-R451.plan.md

```ts
export type Weather = 'clear' | 'rain' | 'snow';
export interface TrafficInput {
  readonly roadId: string;
  readonly baseVolume: number;
  readonly hour: number;
  readonly weather: Weather;
  readonly event: boolean;
}
export type Level = 'HIGH' | 'MED' | 'LOW';
export interface Prediction {
  readonly roadId: string;
  readonly predicted: number;
  readonly ratio: number;
  readonly level: Level;
}
```

계수: peak(7-9,17-19)=1.6, day=1.0, night=0.5 / rain=1.2, snow=1.5 / event +0.3
레벨: ratio≥2.0 HIGH, ≥1.3 MED, else LOW
