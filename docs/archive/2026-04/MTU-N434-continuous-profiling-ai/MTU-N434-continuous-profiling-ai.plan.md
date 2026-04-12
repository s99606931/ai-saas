# MTU-N434: Continuous Profiling AI

## WHY
- Pyroscope/Parca 패턴: 지속적 CPU/힙 프로파일 수집 + AI 이상 패턴 감지
- Hot path 자동 탐지로 성능 회귀 조기 대응

## FR
- FR-N434.1 스택 샘플링 집계 (플레임그래프 원본 구조)
- FR-N434.2 Hot function Top-N 추출
- FR-N434.3 버전 간 차분 프로파일 (regression detection)
- FR-N434.4 AI 이상 패턴 분류 (lock contention / GC storm / 메모리 누수)
- FR-N434.5 성능 개선 추천 생성

## Success Criteria
- Hot function 식별 정확도 95%+
- 성능 회귀 탐지 재현율 85%+
