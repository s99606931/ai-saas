# 공공 SaaS 프레임워크 — 포크 가이드

> **목표**: 포크 후 10일 이내 비즈니스 서비스 개발 착수
> **대상**: 공공기관 SaaS 사업자, SI 개발사

---

## 1단계: 저장소 포크 (1일차)

```bash
# 1. 저장소 포크
git clone https://github.com/your-org/public-saas-framework.git my-saas
cd my-saas

# 2. 환경 구성 스크립트 실행
chmod +x scripts/setup-fork.sh
./scripts/setup-fork.sh
```

## 2단계: 환경 변수 설정 (2일차)

```bash
# .env.example → .env 복사 후 편집
cp .env.example .env

# 필수 환경 변수 설정
# - DATABASE_URL: PostgreSQL 16 연결 문자열
# - JWT_PRIVATE_KEY / JWT_PUBLIC_KEY: RS256 키 쌍
# - ENCRYPTION_KEY: AES-256 암호화 키 (32바이트 hex)
# - FILE_ENCRYPTION_KEY: 파일 암호화 키 (32바이트 hex)
```

## 3단계: 인프라 기동 (3일차)

```bash
# Docker Compose로 의존 서비스 기동
docker compose up -d

# 데이터베이스 마이그레이션
pnpm prisma migrate deploy

# 시드 데이터 생성 (선택)
pnpm prisma db seed
```

## 4단계: 비즈니스 서비스 개발 (4~8일차)

```bash
# 1. 서비스 디렉토리 생성
mkdir -p platform/services/my-service/src/{handlers,lib}

# 2. 매니페스트 작성 (Business SDK 활용)
# platform/services/my-service/src/manifest.ts
import type { ServiceManifest } from '@public-saas/business-sdk';

export const manifest: ServiceManifest = {
  id: 'my-service',
  name: '나의 서비스',
  description: '비즈니스 서비스 설명',
  version: '1.0.0',
  category: '업무',
  icon: '📋',
  port: 3020,
  routes: [
    { method: 'GET', path: '/items', description: '목록 조회', auth: true },
  ],
  permissions: [
    { resource: 'items', actions: ['create', 'read', 'update', 'delete'] },
  ],
  menuItems: [
    { label: '나의 서비스', path: '/my-service', icon: '📋' },
  ],
};

# 3. CSAP 가드 적용 (자동 RBAC + 감사 로그)
import { csapGuard, auditHook } from '@public-saas/business-sdk';

# 4. 서비스 등록
import { registerService } from '@public-saas/business-sdk';
await registerService(manifest);
```

## 5단계: 검증 및 배포 (9~10일차)

```bash
# 통합 테스트 실행
pnpm test:integration

# CSAP 자동 검증
pnpm test:csap

# 빌드 및 배포
pnpm build
```

---

## 체크리스트

- [ ] .env 파일 설정 완료 (시크릿 절대 커밋 금지)
- [ ] Docker Compose 기동 확인
- [ ] DB 마이그레이션 완료
- [ ] 비즈니스 서비스 매니페스트 작성
- [ ] CSAP 가드 적용 확인
- [ ] 감사 로그 기록 확인
- [ ] 통합 테스트 통과

---

## 7단계: CSAP/ISMS-P 인증 대응

포크 기관의 인증 준비를 위한 가이드입니다.

### 인증 범위 재정의

1. 기관별 인증 범위를 재정의합니다 (시스템/서비스/조직/물리적 범위)
2. 프레임워크 기본 증적을 기관 환경에 맞게 조정합니다

### 증적 재활용

- CSAP: `docs/framework/02-csap/standard-grade/evidence-mapping.md` 참조
- ISMS-P: `docs/framework/03-isms-p/csap-isms-mapping.md` 참조
- 통합 증적: `docs/framework/03-isms-p/integrated-evidence/package-guide.md` 참조

### 감리 대응

- 감리 산출물 T01~T07 템플릿 활용: `docs/framework/07-audit-compliance/`
- 포크 기관용 감리 가이드: `docs/framework/06-ecosystem/troubleshooting-faq.md` 3절 참조

---

## 8단계: 운영 및 유지보수

### 업스트림 변경 반영

```bash
# 업스트림 저장소 등록
git remote add upstream https://github.com/your-org/public-saas-framework.git

# 분기별 업스트림 동기화
git fetch upstream
git merge upstream/main
# 충돌 해결 후 커밋
```

### 보안 패치 적용

1. 업스트림 보안 공지 모니터링
2. `scripts/security-audit.sh` 월간 실행
3. 의존성 업데이트: `pnpm update --latest`

### 커스터마이징 영역 표시

프레임워크 코드와 기관 커스터마이징 코드를 구분하기 위해 다음 주석을 사용하세요:

```typescript
// === FORK CUSTOM START: {기관명} ===
// 기관 고유 비즈니스 로직
// === FORK CUSTOM END ===
```

---

## 상세 문서 링크

| 문서 | 설명 |
|------|------|
| [현장 적용 체크리스트](docs/framework/06-ecosystem/deployment-checklist.md) | 35항목 상세 체크리스트 |
| [트러블슈팅/FAQ](docs/framework/06-ecosystem/troubleshooting-faq.md) | 오류 해결 + FAQ 20건 |
| [플러그인 개발 가이드](docs/framework/06-ecosystem/plugin-development-guide.md) | 비즈니스 플러그인 작성법 |

---

## 주의사항

1. **시크릿 관리**: `.env`, `secrets.*` 파일은 절대 커밋하지 마세요
2. **CSAP 준수**: `csapGuard()` 미들웨어를 반드시 적용하세요 (D-08 RBAC 필수)
3. **감사 로그**: 모든 민감 작업에 `auditHook()` 적용 (D-06 필수)
4. **N2SF 데이터 등급**: C/S등급 데이터는 AI API 전송 금지
5. **한국어 문서**: 모든 산출물은 한국어로 작성하세요
