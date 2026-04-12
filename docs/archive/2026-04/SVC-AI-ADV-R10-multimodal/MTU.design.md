# SVC-AI-ADV-R10: Multimodal AI — Design

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead
> Plan 참조: docs/01-plan/mtus/SVC-AI-ADV-R10.plan.md

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-11 | ��안 작성 | PM Lead |

---

## Design Anchor

**선택: VLM 우선 + OCR 폴백 (Pragmatic Balance)**
- Vision-Language 모델이 가용하면 이미지 직접 분석
- VLM 미가용 시 OCR(Tesseract) → 텍스트 추출 → LLM 분석

---

## §1 멀티모달 프로세서 (multimodal-processor.ts)

### 1.1 이미지 전처리 파이프라인

```
입력 이미지 → 형식 검증 → 해상도 조정 → base64 인코딩 → VLM 전송
```

- 지원 형식: JPEG, PNG, WebP, TIFF, BMP
- 최대 해상도: 4096x4096 (초과 시 축소)
- 최대 파일 크기: 10MB
- 출력: base64 + data URI

### 1.2 VLM 메시지 구조

```typescript
{
  role: 'user',
  content: [
    { type: 'image_url', image_url: { url: 'data:image/jpeg;base64,...' } },
    { type: 'text', text: '이 문서 이미지를 분석하십시오.' }
  ]
}
```

---

## §2 문서 분석기 (document-analyzer.ts)

### 2.1 분석 모드

| 모드 | 설명 | 프롬프트 |
|------|------|---------|
| extract_text | 전문 텍스트 추출 | "이미지의 모든 텍스트를 추출" |
| analyze_table | 표 구조 분석 | "표의 행/열 구조를 JSON으로" |
| detect_seal | 도장/서명 감지 | "도장, 서명의 위치와 유형" |
| classify | 문서 유형 분류 | "공문서 유형 판별" |
| full_analysis | 전체 분석 | 위 모든 항목 통합 |

### 2.2 분석 결과 구조

```typescript
interface DocumentAnalysisResult {
  text?: string;                // 추출된 텍스트
  tables?: TableStructure[];    // 표 구조
  seals?: SealDetection[];      // 도장/서명
  classification?: DocClass;    // 문서 분류
  confidence: number;
  processingTimeMs: number;
}
```

---

## Session Guide

1. multimodal-processor.ts: 이미지 전처리 + base64 + VLM 메시지 빌더
2. document-analyzer.ts: 분석 모드별 프롬프트 + 결과 파서 + OCR 폴백 + PII 마스킹
