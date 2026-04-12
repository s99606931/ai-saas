# SVC-AI-ADV-R31: Text2SQL DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B -- Pragmatic Balance

LLM 기반 SQL 생성 + 다중 검증 레이어 (구문 + 보안 + 실행 계획)

---

## §1 자연어→SQL 변환 (FR-ADV31.1)

변환 파이프라인:
1. 자연어 질의 수신
2. 관련 스키마 컨텍스트 추출
3. LLM 프롬프트 구성 (Few-shot + Schema + Query)
4. SQL 생성
5. SQL 검증 (§3)
6. 파라미터 추출 (§4)
7. 결과 반환

## §2 스키마 인식 (FR-ADV31.2)

스키마 레지스트리:
- 테이블명, 컬럼명, 데이터 타입, 설명
- 관계 정보 (외래 키, JOIN 조건)
- 접근 권한 메타데이터 (테넌트별)
- 자주 사용되는 쿼리 패턴 (Few-shot 예시)

## §3 SQL 검증 (FR-ADV31.3)

3단계 검증:
1. 구문 검증: SQL 파싱 + 구문 오류 검출
2. 보안 검증: 위험 패턴 차단 (DROP, DELETE, UPDATE, INSERT)
3. 실행 계획 검증: EXPLAIN 기반 비용 추정

## §4 SQL 주입 방지 (FR-ADV31.4)

CSAP D-12 필수:
- 사용자 입력값 → 매개변수 바인딩 ($1, $2 ...)
- 리터럴 값 자동 파라미터화
- 문자열 결합 SQL 절대 차단

## §5 읽기 전용 강제 (FR-ADV31.5)

허용 목록 방식:
- SELECT 문만 허용
- WITH (CTE) + SELECT 허용
- 나머지 전부 차단 (INSERT, UPDATE, DELETE, DROP, ALTER, TRUNCATE, GRANT 등)

## §6 쿼리 설명 (FR-ADV31.6)

SQL → 자연어 역변환:
- 생성된 SQL을 사람이 읽을 수 있는 설명으로 변환
- 사용된 테이블, 조건, 집계 함수 설명

## §7 실행 제한 (FR-ADV31.7)

안전 장치:
- LIMIT 절 강제 (기본 100, 최대 1000)
- 쿼리 타임아웃: 10초 (기본)
- 서브쿼리 깊이 제한: 3단계
- UNION 개수 제한: 5개
