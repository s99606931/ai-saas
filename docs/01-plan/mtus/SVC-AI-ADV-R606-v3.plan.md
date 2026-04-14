# SVC-AI-ADV-R606 (v3) Plan — AI기반 민원인 감정 분석 v3

## Context Anchor
| 항목 | 내용 |
|------|------|
| WHY | 민원 텍스트의 부정/긍정 신호 자동 분석으로 응대 우선순위 결정 |
| WHO | 민원 운영팀, 콜센터 |
| RISK | 부정 민원 누락 방지 + PII 마스킹 |
| SUCCESS | SC-R606v3-1: 키워드 기반 점수 / SC-R606v3-2: 등급 / SC-R606v3-3: 마스킹 |
| SCOPE | citizen-sentiment-analyzer-v3.ts 구현 (트랙 A 22차) |

## 기능 요구사항
- FR-R606v3.1: 입력 (id, citizenEmail, text, grade: 'C'|'S'|'O')
- FR-R606v3.2: C/S → BLOCKED
- FR-R606v3.3: 부정 키워드 (분노, 불만, 항의, 화나, 최악, 최저), 긍정 키워드 (감사, 만족, 친절, 좋, 최고)
- FR-R606v3.4: score = positiveCount - negativeCount, 등급 (≤-2: NEGATIVE, ≥2: POSITIVE, else NEUTRAL)
- FR-R606v3.5: citizenEmail PII 마스킹 (SHA-256 16자)

## 추적성
FR-R606v3.* ↔ `citizen-sentiment-analyzer-v3.ts` ↔ 테스트 ↔ N2SF N-05, CSAP D-08
