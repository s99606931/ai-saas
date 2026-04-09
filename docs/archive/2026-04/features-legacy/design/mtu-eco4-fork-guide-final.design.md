# MTU-ECO4 — 포크 지원 가이드 최종화 설계

> **문서 ID**: MTU-ECO4-DESIGN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ECO4.1~FR-ECO4.5
> **참조**: docs/01-plan/features/mtu-eco4-fork-guide-final.plan.md

---

## 1. 아키텍처 선택

**선택안**: Pragmatic Balance
- 기존 FORK-GUIDE.md 확장 (파괴적 변경 없음)
- 별도 체크리스트/FAQ 문서로 분리 (FORK-GUIDE 경량 유지)
- 환경별 분기 (WSL2/Linux/Docker) 명확화

## 2. 산출물 설계

### 2.1 FORK-GUIDE.md 확장

기존 6단계에 다음 섹션 추가:
```
FORK-GUIDE.md (기존 확장)
├── ... (기존 1~6단계 유지)
├── 7단계: CSAP/ISMS-P 인증 대응
│   ├── 인증 범위 재정의 (포크 기관용)
│   ├── 증적 재활용 가이드
│   └── 감리 대응 체크리스트 링크
├── 8단계: 운영 및 유지보수
│   ├── 업스트림 변경 반영 (rebase 전략)
│   ├── 보안 패치 적용 절차
│   └── 커스터마이징 영역 표시
└── 참고 문서 링크
    ├── deployment-checklist.md
    └── troubleshooting-faq.md
```

### 2.2 현장 적용 체크리스트 (FR-ECO4.1, FR-ECO4.2)

```
docs/framework/06-ecosystem/deployment-checklist.md
├── Phase A: 사전 준비 (10항목)
│   ├── A01: 서버 사양 확인 (CPU 4코어+, RAM 16GB+, SSD 100GB+)
│   ├── A02: 네트워크 요건 (인터넷 접속, 내부망 분리)
│   ├── A03: OS 설치 (Ubuntu 22.04 LTS 또는 RHEL 8+)
│   ├── A04: Docker 설치 (24.0+)
│   ├── A05: Node.js 설치 (20 LTS)
│   ├── A06: pnpm 설치 (9.x)
│   ├── A07: Git 설치 (2.40+)
│   ├── A08: PostgreSQL 16 접근 확인
│   ├── A09: Redis 7 접근 확인
│   └── A10: DNS/SSL 인증서 준비
├── Phase B: 포크 및 설정 (8항목)
│   ├── B01: 저장소 포크/클론
│   ├── B02: .env 파일 생성 (env.example 기반)
│   ├── B03: JWT 키 쌍 생성 (RS256)
│   ├── B04: 암호화 키 생성 (AES-256)
│   ├── B05: 데이터베이스 생성 및 마이그레이션
│   ├── B06: 시드 데이터 주입 (기관 정보 변경)
│   ├── B07: 의존성 설치 (pnpm install)
│   └── B08: 환경별 설정 (WSL2/Linux/Docker)
├── Phase C: 검증 (7항목)
│   ├── C01: 전체 서비스 기동 확인
│   ├── C02: 포털 접속 확인 (브라우저)
│   ├── C03: 로그인/인증 확인
│   ├── C04: API 응답 확인 (헬스체크)
│   ├── C05: DB 연동 확인
│   ├── C06: E2E 테스트 실행
│   └── C07: 보안 스캔 실행
├── Phase D: 커스터마이징 (5항목)
│   ├── D01: 기관 로고/브랜딩 변경
│   ├── D02: 테넌트 정보 설정
│   ├── D03: 메뉴/권한 구조 설정
│   ├── D04: 플러그인 추가 (필요 시)
│   └── D05: CI/CD 파이프라인 설정
└── Phase E: 운영 (5항목)
    ├── E01: 백업 정책 설정
    ├── E02: 모니터링 설정
    ├── E03: 로그 보존 정책 (1년+)
    ├── E04: 보안 패치 주기 설정
    └── E05: 업스트림 동기화 일정
```

### 2.3 트러블슈팅/FAQ (FR-ECO4.3, FR-ECO4.4)

```
docs/framework/06-ecosystem/troubleshooting-faq.md
├── 1. 트러블슈팅 (10건+)
│   ├── TS01: Docker Compose 기동 실패 (포트 충돌)
│   ├── TS02: PostgreSQL 연결 거부 (pg_hba.conf)
│   ├── TS03: pnpm install 의존성 오류
│   ├── TS04: Prisma 마이그레이션 실패
│   ├── TS05: JWT 토큰 검증 실패 (키 불일치)
│   ├── TS06: Redis 연결 타임아웃
│   ├── TS07: Next.js 빌드 오류 (환경 변수 누락)
│   ├── TS08: WSL2 메모리 부족
│   ├── TS09: SSL 인증서 오류 (자체 서명)
│   └── TS10: 파일 권한 오류 (Linux)
├── 2. FAQ (20건+)
│   ├── Q01: 최소 서버 사양은?
│   ├── Q02: Windows에서 실행 가능한가?
│   ├── Q03: 외부 DB 연결은 가능한가?
│   ├── Q04: 멀티테넌시 없이 단일 기관용으로 사용 가능한가?
│   ├── Q05: CSAP 인증 없이 사용 가능한가?
│   └── ... (20건+)
└── 3. 감리 대응 가이드 (FR-ECO4.5)
    ├── 포크 기관의 감리 대상 산출물
    ├── 감리 기준 <-> 프레임워크 산출물 매핑
    └── 감리 당일 시연 준비 가이드
```

## 3. 추적성 매트릭스

| FR ID | 설계 섹션 | 산출물 | 검증 |
|-------|---------|--------|------|
| FR-ECO4.1 | 2.2 | deployment-checklist.md | 35항목 체크리스트 |
| FR-ECO4.2 | 2.2 B08 | deployment-checklist.md 내 | 3개 환경 |
| FR-ECO4.3 | 2.3 1절 | troubleshooting-faq.md | 10건+ |
| FR-ECO4.4 | 2.3 2절 | troubleshooting-faq.md | 20건+ |
| FR-ECO4.5 | 2.3 3절 | troubleshooting-faq.md | 감리 매핑 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
