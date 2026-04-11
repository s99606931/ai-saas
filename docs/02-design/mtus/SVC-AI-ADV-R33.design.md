# SVC-AI-ADV-R33: AI 개인화 엔진 DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B -- Pragmatic Balance

이벤트 수집 + 프로파일링 + 임베딩 유사도 추천. PII 완전 마스킹.

---

## §1 행동 이벤트 수집 (FR-ADV33.1)

이벤트 타입: view, click, search, download, bookmark, share
이벤트 데이터: userId(해시), contentId, eventType, timestamp, context
이벤트 버퍼: 메모리 내 배치 수집 → 주기적 프로파일 갱신

## §2 사용자 프로파일 (FR-ADV33.2)

프로파일 구성:
- interests: 카테고리별 관심도 점수 (0~1)
- recentItems: 최근 상호작용 콘텐츠 (최대 100개)
- preferences: 시간대, 형식, 언어 선호
- embedding: 사용자 관심사 벡터 (임베딩 평균)

## §3 콘텐츠 추천 (FR-ADV33.3)

추천 알고리즘:
- 콘텐츠 임베딩 ↔ 사용자 임베딩 코사인 유사도
- 인기도 가중치 (최근 7일 조회수)
- 다양성 보장 (MMR: Maximal Marginal Relevance)
- 이미 본 콘텐츠 제외

## §4 테넌트 격리 (FR-ADV33.4)

CSAP D-08: 테넌트별 프로파일 저장소 분리
키 프리픽스: tenant:{tenantId}:profile:{userId}

## §5 PII 마스킹 (FR-ADV33.5)

N2SF 필수: 프로파일에 원본 PII 저장 금지
userId → SHA-256 해시, 이름/이메일 미저장

## §6 A/B 테스트 (FR-ADV33.6)

실험 프레임워크: 알고리즘 변형 랜덤 배정 + 성과 측정
