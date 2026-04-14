# SVC-AI-ADV-R514 Design — public-service-accessibility-assessor-v3.ts

Plan Ref: SVC-AI-ADV-R514.plan.md

```ts
export type AccessibilityGrade = 'A' | 'B' | 'C' | 'D';
export interface AccessibilityCheck {
  readonly serviceId: string;
  readonly hasAltText: boolean;
  readonly hasKeyboardNav: boolean;
  readonly hasColorContrast: boolean;
  readonly hasCaptionVideo: boolean;
  readonly hasScreenReader: boolean;
}
export interface AccessibilityResult {
  readonly serviceId: string;
  readonly score: number;       // 0~100 (each criterion = 20)
  readonly grade: AccessibilityGrade;
  readonly missing: readonly string[];
}
```

score = count(true items) * 20
grade: >=80→A, >=60→B, >=40→C, else D
missing: name of false items ['altText','keyboardNav','colorContrast','captionVideo','screenReader']
