# SVC-AI-ADV-R34: AI 코드 리뷰 Assistant DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B -- Pragmatic Balance

정적 분석 규칙 엔진(1차) + LLM 심층 리뷰(2차) 하이브리드.

---

## §1 보안 코딩 검사 (FR-ADV34.1)

규칙 기반 패턴:
- SQL 주입: 문자열 결합 쿼리 탐지
- XSS: innerHTML 직접 할당, dangerouslySetInnerHTML
- 하드코딩 시크릿: API 키, 비밀번호 패턴
- 미인증 접근: 인증/권한 검사 없는 API 핸들러
- 안전하지 않은 역직렬화: eval, Function 생성자
- 경로 순회: req.params를 파일 경로에 직접 사용

## §2 LLM 코드 리뷰 (FR-ADV34.2)

LLM에 코드 + 컨텍스트 전송:
- 파일 내용 (PII/시크릿 마스킹 후)
- 함수 목적 설명
- 관련 인터페이스/타입 정의
출력: 개선점, 버그 가능성, 설계 제안

## §3 코드 복잡도 분석 (FR-ADV34.3)

측정 지표:
- 순환 복잡도 (Cyclomatic Complexity)
- 함수 줄 수 (80줄 초과 경고)
- 중첩 깊이 (4단계 초과 경고)
- 파라미터 수 (5개 초과 경고)

## §4 리뷰 보고서 (FR-ADV34.4)

보고서 구조:
- severity별 발견 건수 요약
- 항목별: 파일, 줄 번호, 규칙 ID, 설명, 수정 제안

## §5 차이점 분석 (FR-ADV34.5)

Git diff 파싱: 추가/수정된 줄만 분석 대상

## §6 자동 수정 제안 (FR-ADV34.6)

간단한 패턴 자동 수정:
- 하드코딩 시크릿 → process.env 참조
- console.log → logger 대체
