# SVC-AI-ADV-R21: Context Window Manager DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

토큰 예산 할당 + 중요도 기반 압축 + 동적 슬라이딩 윈도우

---

## Design Anchor

- **WHY**: 대규모 문서를 LLM 컨텍스트에 최적 배치하여 품질/비용 양립
- **HOW**: 토큰 예산 4구역 분할 → 중요도 순 청크 배치 → 오버플로우 압축
- **CONSTRAINT**: 모델별 최대 토큰 제한 준수, PII 마스킹된 텍스트만 컨텍스트

---

## §1 토큰 예산 관리 (FR-ADV21.1)

4개 영역:
- system: 시스템 프롬프트 (고정, 전체의 10~15%)
- context: RAG 검색 결과 + 장기 메모리 (전체의 40~50%)
- conversation: 대화 이력 (전체의 20~30%)
- generation: 응답 생성 예약 (전체의 15~20%)

모델별 한도: { 'gpt-4': 128000, 'claude-3': 200000, 'local': 32000 }

## §2 컨텍스트 압축 (FR-ADV21.2)

전략:
- extractive: 핵심 문장만 추출 (빠름, 토큰 50~70% 절감)
- abstractive: LLM 요약 (느림, 토큰 70~90% 절감)
- map-reduce: 청크별 요약 → 요약의 요약 (대규모 문서용)

## §3 청크 우선순위 (FR-ADV21.3)

점수 = relevance * 0.5 + recency * 0.2 + importance * 0.3
relevance: 벡터 유사도 (0~1)
recency: 시간 감쇠 함수 (최신 = 1.0)
importance: 소스 가중치 (법령 > 공문 > FAQ)

## §4 슬라이딩 윈도우 (FR-ADV21.4)

대화 진행에 따라 오래된 턴을 요약으로 대체
유지 윈도우: 최근 N턴 원본 + 이전 턴 요약

## §5 오버플로우 처리 (FR-ADV21.5)

우선순위 역순으로 청크 제거: 낮은 점수부터 폐기
마지막 수단: 가장 긴 청크를 extractive 압축
