# SVC-AI-ADV-R233 Design: AI기반 공공 데이터 품질 예측

## 구현 파일
`platform/services/ai-service/src/lib/public-data-quality-predictor.ts`

## 핵심 설계
- `DatasetProfile`: datasetId, grade (C/S/O)
- `QualityMeasurement`: dimension, score (0~100)
- `predict()`: 4차원 평균 → overallScore → EXCELLENT(≥90)/GOOD(≥75)/FAIR(≥60)/POOR
- 기본값: 측정 없을 시 각 차원 70점 (FAIR 결과)

## N2SF 준수
- N-05: grade C/S → BLOCKED 예외 발생
- O 등급만 분석 허용
