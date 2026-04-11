# SVC-AI-ADV-R19: AI Feedback Loop DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-11 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B — Pragmatic Balance

다채널 피드백 수집 + 선호도 데이터셋 생성 + 품질 추이 모니터링

---

## Design Anchor

- **WHY**: 사용자 피드백 기반 AI 품질 지속 개선. RLHF/DPO 학습 데이터 축적
- **HOW**: 구조화된 피드백 수집 + PII 마스킹 후 데이터셋 변환 + 품질 알림
- **CONSTRAINT**: N2SF PII 마스킹, CSAP D-09 피드백 암호화 저장

---

## §1 피드백 수집기 (FR-ADV19.1)

FeedbackEntry: id, responseId, userId, tenantId, type (thumbs|rating|text), value, timestamp
유형별:
- thumbs: 'up' | 'down'
- rating: 1~5
- text: 자유 기술 (PII 마스킹)

## §2 비교 피드백 (FR-ADV19.2)

ComparisonFeedback: responseA, responseB, preferred ('A' | 'B' | 'tie'), reason
DPO 포맷 변환: (prompt, chosen, rejected) 트리플

## §3 피드백 집계 (FR-ADV19.3)

집계 차원: 프롬프트명, 모델명, 기간
통계: 평균 별점, 긍정률, NPS(Net Promoter Score)

## §4 선호도 데이터셋 (FR-ADV19.4)

JSONL 내보내기: {"prompt": "...", "chosen": "...", "rejected": "..."}
DPO/RLHF 학습 프레임워크 호환 포맷

## §5 품질 추이 (FR-ADV19.5)

7일 이동 평균 만족도 계산
이전 7일 대비 10% 이상 하락 시 경고 발생
