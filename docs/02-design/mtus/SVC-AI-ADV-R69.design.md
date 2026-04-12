# SVC-AI-ADV-R69 — 설계

## 모듈
- `multimodal-rag.ts`
  - `MultiModalRAG` 클래스 (multimodal-processor.ts와 별개, 검색 중심)

## 핵심 타입
```typescript
type Modality = 'text' | 'image' | 'ocr';
type DataGrade = 'C' | 'S' | 'O';

interface MultiModalDoc {
  id: string;
  modality: Modality;
  title: string;
  text?: string;               // text/ocr용
  imageMeta?: {
    width: number;
    height: number;
    hasExifGps: boolean;       // EXIF GPS 존재 여부 (입력자 제공)
    source: string;
  };
  grade: DataGrade;
  tags: string[];
}

interface QueryOpts {
  text: string;
  modalities?: Modality[];     // default 모두
  topK: number;
  weights?: Partial<Record<Modality, number>>;
}

interface FusionResult {
  docId: string;
  modality: Modality;
  score: number;
  sources: { modality: Modality; score: number }[];
}
```

## 흐름
```
addDocument(doc) →
  - grade !== 'O' → GRADE_BLOCKED
  - modality==='image' && imageMeta.hasExifGps → EXIF_BLOCKED
  - 모달별 index에 삽입

query(opts) →
  각 modality별로 간단 BM25류 스코어 (토큰 매칭 개수 / 길이)
  RRF(Reciprocal Rank Fusion) 혹은 가중합으로 결합
  top-K 반환
```

## 퓨전 랭킹
- 기본: weighted sum (text=0.5, image=0.3, ocr=0.2)
- 선택: RRF — `1/(k + rank)` (k=60)
- 같은 docId가 여러 모달에 존재하면 합산

## 보안
- EXIF GPS 있는 이미지 차단 (N-05)
- grade 검증
- 감사: DOC_ADD / DOC_BLOCK / QUERY / EXIF_BLOCK

## 감사 로그
`getAuditLog()` 제공
