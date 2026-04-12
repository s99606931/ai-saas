# SVC-AI-ADV-R46 — 완료 보고
> matchRate 100%
- 산출물: document-classifier.ts, classification-pipeline.ts
- 4차원 분류 (보안등급/부서/유형/기한) + softmax 신뢰도
- 오분류 방지: 보안 분류 신뢰도 0.85 미만 시 인간 검토 에스컬레이션
