# SVC-AI-ADV-R40 — 번역 엔진 설계

> 2026-04-12 | v1.0.0 | Plan: SVC-AI-ADV-R40.plan.md

## 설계 요약
- 번역 엔진: 로컬 NLLB-200 1.3B + 도메인 용어집 pre/post 처리
- 용어집: 행정·법령 k/v 저장, 도메인별 버전 관리
- 평가: sacreBLEU 기반 자동 평가 + 인간 평가 연동 훅

## 옵션 비교
| 옵션 | 설명 | 결정 |
|---|---|---|
| A | 외부 DeepL API | ❌ C/S등급 유출 위험 |
| B | 로컬 NLLB + 용어집 | ✅ 채택 (규정 준수) |
| C | 하이브리드 | △ (향후 확장) |

## 모듈
```
ai-translator.ts          # 번역 오케스트레이터, 등급 가드, 용어집 적용
terminology-manager.ts    # 용어집 CRUD, 도메인별 관리
translation-evaluator.ts  # BLEU 계산, 품질 리포트
```

## 데이터 흐름
```
입력 텍스트 + sourceLang + targetLang + grade
  → grade 검증 (C/S 차단)
  → PII 마스킹 적용
  → terminologyManager.preprocess (용어 치환)
  → NLLB 로컬 모델 호출
  → terminologyManager.postprocess (용어 복원)
  → translationEvaluator 샘플링 평가
  → 결과 반환
```

## 인터페이스
```typescript
type Lang = 'ko' | 'en' | 'ja' | 'zh'
type Grade = 'O' | 'C' | 'S'

class AITranslator {
  translate(text: string, opts: {source: Lang; target: Lang; grade: Grade; domain?: string}): Promise<TranslationResult>
}

class TerminologyManager {
  addTerm(domain: string, source: Lang, target: Lang, term: string, translation: string): void
  preprocess(text: string, domain: string, source: Lang, target: Lang): {text: string; placeholders: Map<string, string>}
  postprocess(text: string, placeholders: Map<string, string>): string
}

class TranslationEvaluator {
  computeBLEU(candidate: string, references: string[]): number
  evaluate(result: TranslationResult, reference: string): QualityReport
}
```

## 보안
- Grade C/S 입력 즉시 throw (N2SF N-05)
- 번역 결과 audit.jsonl 기록 (actor, action='TRANSLATE', langs)
- 외부 API 차단 URL 검증
