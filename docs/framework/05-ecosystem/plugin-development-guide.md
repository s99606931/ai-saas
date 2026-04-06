# 플러그인 개발 가이드

> **문서 ID**: ECO-PLUGIN-GUIDE
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ECO3 | **Design Ref**: MTU-ECO3 Design 2.3

---

## 1. 플러그인 아키텍처 개요

### 1.1 ServiceManifest 인터페이스

모든 플러그인은 `manifest.ts`에서 ServiceManifest를 정의해야 합니다:

```typescript
export const manifest = {
  id: 'my-plugin',           // 플러그인 고유 ID
  name: '내 플러그인',        // 표시명 (한국어)
  description: '설명',       // 플러그인 설명
  version: '1.0.0',         // 시맨틱 버저닝
  port: 3020,               // 서비스 포트
  routes: {                  // API 엔드포인트 목록
    prefix: '/api/v1',
    endpoints: ['GET /resources', 'POST /resources'],
  },
  permissions: [             // 필요 권한 목록
    'resource:read',
    'resource:create',
  ],
} as const;
```

### 1.2 디렉토리 구조

```
platform/plugins/my-plugin/
├── package.json           # 의존성 (hono, zod 필수)
├── tsconfig.json          # TypeScript 설정
├── src/
│   ├── index.ts           # 진입점 (Hono 앱 + 라우트 등록)
│   ├── manifest.ts        # ServiceManifest 정의
│   ├── handlers/          # API 핸들러 (기능별 분리)
│   │   └── example.handler.ts
│   ├── lib/               # 비즈니스 로직
│   │   └── example-engine.ts
│   └── schemas/           # Zod 검증 스키마
│       └── example.schema.ts
└── README.md              # 플러그인 사용법
```

## 2. 보안 준수 사항 (필수)

### 2.1 CSAP D-08: RBAC 적용

```typescript
// 모든 API 핸들러에서 인증 검사 필수
app.get('/resources', async (c) => {
  const userId = c.req.header('x-user-id');
  if (!userId) {
    return c.json({ error: '인증 필요' }, 401);
  }
  // 비즈니스 로직
});
```

### 2.2 CSAP D-12: 입력 검증

```typescript
import { z } from 'zod';

const schema = z.object({
  name: z.string().min(1).max(100),
  email: z.string().email(),
});

app.post('/resources', async (c) => {
  const body = await c.req.json();
  const validated = schema.parse(body); // 검증 실패 시 ZodError
  // validated 사용
});
```

### 2.3 감사 로그

```typescript
// 민감 작업(생성/수정/삭제) 시 감사 로그 기록
const auditLog = {
  actor: userId,
  action: 'RESOURCE_CREATE',
  target: resourceId,
  timestamp: new Date().toISOString(),
};
// audit-service에 전송 또는 로컬 로깅
```

## 3. 코드 주석 규칙

```typescript
// Design Ref: MTU-{ID} Design {섹션}
// Plan SC: FR-{ID}
```

모든 핸들러/모듈 상단에 설계 참조 주석 필수.

## 4. 샘플 플러그인

| 플러그인 | 경로 | 기능 |
|---------|------|------|
| 전자결재 | `platform/plugins/electronic-approval/` | 기안/결재/승인/반려 |
| 공공데이터 연동 | `platform/plugins/public-data-integration/` | 데이터 검색/캐싱/변환 |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
