---
sidebar_position: 3
---

# 첫 번째 서비스 만들기

FORK-GUIDE.md의 4단계를 참조하여 비즈니스 서비스를 생성합니다.

## 서비스 생성

```bash
mkdir -p platform/services/my-service/src/{handlers,lib}
```

## manifest.ts 작성

```typescript
import type { ServiceManifest } from '@public-saas/business-sdk';

export const manifest: ServiceManifest = {
  id: 'my-service',
  name: '나의 서비스',
  version: '1.0.0',
  port: 3020,
};
```

## 핸들러 작성

```typescript
// src/handlers/example.handler.ts
import { Hono } from 'hono';
import { z } from 'zod';

const app = new Hono();

const schema = z.object({
  name: z.string().min(1).max(100),
});

app.post('/api/v1/examples', async (c) => {
  const body = await c.req.json();
  const validated = schema.parse(body);
  return c.json({ message: `Hello, ${validated.name}!` });
});

export default app;
```

자세한 내용은 [플러그인 개발 가이드](/docs/plugins/development-guide)를 참조하세요.
