# MTU-N106: API 문서 자동 생성 — Design

> **MTU ID**: MTU-N106
> **작성일**: 2026-04-10

---

## 아키텍처: Pragmatic Balance

OpenAPI YAML -> docusaurus-plugin-openapi-docs -> MDX -> Docusaurus Build -> 정적 사이트

### 컴포넌트 구성

1. **OpenAPI 스펙**: 각 서비스 API를 단일 통합 스펙으로 관리
2. **Docusaurus 플러그인**: PaloAltoNetworks/docusaurus-openapi-docs v4.x
3. **CI 파이프라인**: API 관련 파일 변경 감지 -> 문서 자동 재생성
4. **배포**: docs-portal 빌드 시 API 문서 포함

### DS-N106.1: OpenAPI 스펙 구조

```yaml
openapi: "3.1.0"
info:
  title: 공공기관 SaaS 프레임워크 API
  version: 2.0.0
paths:
  /api/v1/auth/login: ...
  /api/v1/users: ...
  /api/v1/tenants: ...
tags:
  - name: auth
  - name: users
  - name: tenants
  - name: menus
  - name: audit
```

### DS-N106.2: Docusaurus 플러그인 설정

```javascript
plugins: [
  ['docusaurus-plugin-openapi-docs', {
    id: 'api',
    docsPluginId: 'classic',
    config: {
      'ai-saas-api': {
        specPath: 'static/openapi/ai-saas-api.yaml',
        outputDir: 'docs/api-reference',
        sidebarOptions: { groupPathsBy: 'tag' }
      }
    }
  }]
]
```

### DS-N106.3: 자동 생성 스크립트

```bash
#!/bin/bash
cd docs-portal
npx docusaurus gen-api-docs all
npx docusaurus build
```

## Design Anchor

- Plan SC: FR-N106.1~FR-N106.5 전수 반영
- CSAP: D-08 접근 통제 문서화, D-12 시스템 개발 보안
