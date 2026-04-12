# SVC-AI-ADV-R29: Vector Database 고도화 DESIGN

> 버전: 1.0.0 | 작성일: 2026-04-12 | 작성자: PM Lead (Opus)

## 아키텍처 선택: Option B -- Pragmatic Balance

pgvector 기본 + Qdrant 고성능 하이브리드 구조. 추상화 계층으로 백엔드 교체 투명화.

---

## §1 벡터 DB 추상화 계층 (FR-ADV29.1)

통합 인터페이스 VectorDBProvider:
- upsert(vectors): 벡터 삽입/갱신
- search(query, options): 벡터 유사도 검색
- delete(ids): 벡터 삭제
- getCollectionInfo(): 컬렉션 상태 조회
- healthCheck(): 백엔드 상태 확인

VectorDBManager 클래스:
- 주 백엔드(Qdrant) + 폴백 백엔드(pgvector) 관리
- 자동 라우팅 + 장애 감지 + 폴백 전환

## §2 Qdrant 클라이언트 (FR-ADV29.2)

QdrantClient 클래스:
- REST API 기반 통신 (HTTP/gRPC)
- 컬렉션 생성/삭제/정보 조회
- HNSW 인덱스 설정 (ef_construct, m 파라미터)
- 포인트(벡터) CRUD
- 스크롤 페이지네이션

설정:
- endpoint: 환경 변수 QDRANT_URL
- apiKey: 환경 변수 QDRANT_API_KEY (선택)
- 타임아웃: 10초 기본

## §3 하이브리드 검색 (FR-ADV29.3)

두 가지 검색 모드 결합:
- Dense 검색: 임베딩 벡터 코사인 유사도
- Sparse 검색: BM25 키워드 매칭 (희소 벡터)
- 점수 융합: Reciprocal Rank Fusion (RRF)
- 가중치 조절: denseWeight / sparseWeight

## §4 필터링 검색 (FR-ADV29.4)

메타데이터 필터 조건:
- must: 필수 일치 조건 (AND)
- should: 선택 일치 조건 (OR)
- must_not: 제외 조건
- 범위 필터: gte, lte, gt, lt
- 키워드 필터: match, match_any

벡터 유사도 + 메타데이터 필터 동시 적용

## §5 네임스페이스 격리 (FR-ADV29.5)

CSAP D-08 테넌트 격리:
- 테넌트별 컬렉션 프리픽스: tenant_{tenantId}_{collection}
- 모든 쿼리에 tenantId 필터 강제 주입
- 컬렉션 목록 조회 시 테넌트 필터링
- 교차 테넌트 접근 시도 시 감사 로그 기록

## §6 자동 폴백 (FR-ADV29.6)

장애 감지 + 자동 전환:
- healthCheck 주기: 30초
- 연속 실패 임계값: 3회
- 폴백 활성화 시 pgvector로 라우팅
- 복구 감지 시 자동 원복
- 상태 변경 시 감사 로그 기록

## §7 인덱스 최적화 (FR-ADV29.7)

HNSW 파라미터 자동 튜닝:
- ef_construct: 기본 128, 정확도 우선 시 256
- m: 기본 16, 메모리 제약 시 8
- ef (검색 시): 기본 64, 정확도 우선 시 128
- 벡터 수 기반 자동 조정 로직

## §8 배치 업서트 (FR-ADV29.8)

대량 벡터 삽입:
- 청크 크기: 100개 단위
- 병렬 업서트: 최대 4 동시
- 실패 청크 자동 재시도 (최대 3회)
- 진행률 콜백 지원

---

## Session Guide

| 세션 | 파일 | 내용 |
|------|------|------|
| S1 | qdrant-client.ts | §2 Qdrant REST 클라이언트 |
| S2 | vector-db-manager.ts | §1,§3~§8 통합 매니저 |

## Design Anchor

이 설계의 핵심 결정:
1. 추상화 계층으로 벡터 DB 교체 투명화 (벤더 종속 방지)
2. 테넌트별 컬렉션 격리 (공유 인프라에서도 CSAP D-08 준수)
3. RRF 기반 하이브리드 검색 (키워드 + 의미 검색 결합)
