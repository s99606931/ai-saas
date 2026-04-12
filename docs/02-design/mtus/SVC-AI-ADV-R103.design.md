# SVC-AI-ADV-R103 — Knowledge Distillation Engine (Design)

> 작성일: 2026-04-12 | 버전: 2.0.0 (재작성)
> Plan Ref: docs/01-plan/mtus/SVC-AI-ADV-R103.plan.md

## 1. 아키텍처 옵션

- **Option A**: 외부 ML 프레임워크 연동 (HuggingFace, torch) — 의존성 크고 CSAP 외부 서비스 제약
- **Option B (선정, Pragmatic Balance)**: 오프라인 메타데이터/통계 엔진. 증류 샘플 저장·일치율·우선순위 계산만 담당. 실제 학습은 별도 ML 파이프라인 호출.
- **Option C**: 온라인 실시간 Teacher-Student 대조 — 호출 2배 비용 발생

## 2. 구성 요소

### §2.1 DistillationJob

```typescript
interface DistillationJob {
  jobId: string
  teacherModel: string
  studentModel: string
  createdAt: string
  samples: DistillationSample[]
}
```

### §2.2 DistillationSample

`prompt`, `teacherOutput`, `studentOutput`, `agreementScore` 포함.

### §2.3 일치율 계산

- 토큰화: 공백·한글 문자 단위
- Jaccard = |T ∩ S| / |T ∪ S|
- Job 전체 평균 = 샘플 Jaccard 평균

### §2.4 고가치 샘플 선정

- `agreement < 0.5` 샘플이 학습 가치 높음 → 오름차순 정렬 상위 N건

### §2.5 학습셋 출력

- JSONL: `{prompt, output: teacherOutput}` 형태
- PII 마스킹: 이메일·RRN·전화 정규식 변환

## 3. Session Guide

- 파일: `platform/services/ai-service/src/lib/knowledge-distillation-engine.ts`
- 테스트: `__tests__/knowledge-distillation-engine.test.ts`
- TypeScript strict: `arr[i] ?? defaults` 패턴 필수

## 4. Design Anchor

- **보안**: C/S 등급 차단 (guardDataGrade)
- **감사**: getAuditLog() 필수 (CSAP D-06)
- **결정성**: 재현 가능한 일치율 계산
