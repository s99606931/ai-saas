# SVC-AI-ADV-R38: 엣지 AI 추론 DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B -- Pragmatic Balance

Ollama REST API 클라이언트 + 로컬 모델 매니저 + N2SF 데이터 등급 기반 라우팅

---

## §1 Ollama 클라이언트 (FR-ADV38.1)

REST API 엔드포인트:
- POST /api/generate: 텍스트 생성
- POST /api/chat: 채팅 완성
- POST /api/embeddings: 임베딩 생성
- GET /api/tags: 모델 목록
- POST /api/pull: 모델 다운로드
- DELETE /api/delete: 모델 삭제

## §2 모델 관리 (FR-ADV38.2)

로컬 모델 레지스트리:
- 사용 가능 모델 목록 + 크기/상태
- 자동 다운로드 + 버전 관리
- 모델 사전 로드 (워밍업)

## §3 추론 실행 (FR-ADV38.3)

추론 파이프라인:
1. 요청 수신 (프롬프트 + 설정)
2. 데이터 등급 확인 (N2SF)
3. 로컬 모델 선택
4. 추론 실행
5. 결과 후처리
6. 성능 메트릭 기록

## §4 스트리밍 (FR-ADV38.4)

토큰 스트리밍: Ollama ndjson 스트림 파싱
콜백 기반 토큰 수신

## §5 폴백 라우팅 (FR-ADV38.5)

N2SF 기반 라우팅:
- C/S등급 → 로컬 전용 (외부 전송 금지)
- O등급 → 로컬 우선, 실패 시 외부 API 폴백

## §6 성능 모니터링 (FR-ADV38.6)

메트릭: 토큰/초, 총 추론 시간, VRAM 사용량, 모델 로딩 시간
