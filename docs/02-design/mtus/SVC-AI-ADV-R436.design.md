# SVC-AI-ADV-R436 Design — Environmental Complaint Classifier AI

Plan Ref: SVC-AI-ADV-R436.plan.md

## 인터페이스
```ts
export type ComplaintType = 'NOISE' | 'AIR' | 'WATER' | 'WASTE' | 'OTHER';
export type Urgency = 'HIGH' | 'NORMAL';
export interface Complaint {
  readonly id: string;
  readonly text: string;
  readonly region: string;
}
export interface Classified {
  readonly id: string;
  readonly type: ComplaintType;
  readonly urgency: Urgency;
  readonly agency: string;
  readonly confidence: number;
}
```

## 키워드 사전
- NOISE: 소음, 진동, 공사
- AIR: 매연, 먼지, 악취, 대기
- WATER: 오폐수, 수질, 하천
- WASTE: 쓰레기, 폐기물, 투기
