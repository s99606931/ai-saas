# SVC-AI-ADV-R477 Design — public-document-summarizer-v2.ts

Plan Ref: SVC-AI-ADV-R477.plan.md

```ts
export type DocGrade = 'O' | 'C' | 'S';
export interface Document {
  readonly docId: string;
  readonly content: string;
  readonly grade: DocGrade;
  readonly category: string;
}
export interface Summary {
  readonly docId: string;
  readonly summary: string;   // first sentence of content
  readonly keywords: readonly string[]; // top 5 words by frequency (len>=2, non-stopword)
  readonly wordCount: number;
}
```

C/S 등급: throw `BLOCKED: ${grade}등급 문서 처리 금지`
summary = content를 '. '으로 split 후 첫 요소 trim
keywords = 공백+구두점 분리 후 stopwords 제거, 빈도 내림차순 상위 5개
stopwords: ['은','는','이','가','을','를','의','에','와','과','도','로','으로','한','하다','있다','없다']
