# Docusaurus 문서 포털 설치 및 설정 가이드

> MTU-A5 | FR-7.2 | 적용 기준일: 2026-04-05
> 참조: Docusaurus 3.x, k3s 내부 배포, MTU-F1~F6

---

## 1. 개요

공공기관 SaaS 프레임워크의 68개+ 산출물 파일을 역할별로 탐색 가능한
Docusaurus 기반 문서 포털입니다.

**선택 근거**: MkDocs Material 2025-11 유지보수 모드 진입으로 장기 운영 위험 해소

---

## 2. 설치 및 초기 설정

### 2.1 프로젝트 생성

```bash
# Docusaurus 3.x 프로젝트 생성
npx create-docusaurus@latest docs-portal classic --typescript

cd docs-portal

# 필수 플러그인 설치
npm install @docusaurus/plugin-content-docs@latest
npm install @docusaurus/theme-mermaid@latest
npm install docusaurus-plugin-search-local
```

### 2.2 docusaurus.config.ts

```typescript
import type { Config } from '@docusaurus/types'

const config: Config = {
  title: '공공기관 SaaS 프레임워크',
  tagline: 'CSAP 중/상 등급 인증 + 행안부 감리 준수 통합 프레임워크',
  url: 'https://docs.internal',
  baseUrl: '/',
  organizationName: 'public-saas-framework',
  projectName: 'docs-portal',

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },

  markdown: {
    mermaid: true,
  },
  themes: ['@docusaurus/theme-mermaid'],

  presets: [
    [
      'classic',
      {
        docs: {
          sidebarPath: './sidebars.ts',
          path: '../docs/framework',
          routeBasePath: 'docs',
          showLastUpdateTime: true,
          showLastUpdateAuthor: true,
        },
        theme: {
          customCss: './src/css/custom.css',
        },
      },
    ],
  ],

  plugins: [
    [
      require.resolve('docusaurus-plugin-search-local'),
      {
        hashed: true,
        language: ['ko', 'en'],
        highlightSearchTermsOnTargetPage: true,
        searchResultLimits: 10,
      },
    ],
  ],

  themeConfig: {
    navbar: {
      title: '공공 SaaS 프레임워크',
      items: [
        { type: 'dropdown', label: '역할별 가이드', position: 'left', items: [
          { label: 'CTO/PM', to: '/docs/cto-guide' },
          { label: '개발자', to: '/docs/dev-guide' },
          { label: '감리관', to: '/docs/auditor-guide' },
          { label: '보안 담당자', to: '/docs/security-guide' },
        ]},
        { label: 'CSAP 체크리스트', to: '/docs/csap-checklist', position: 'left' },
        { label: 'ISMS-P', to: '/docs/isms-p', position: 'left' },
      ],
    },
    footer: {
      style: 'dark',
      copyright: `공공기관 SaaS 프레임워크 v1.0.0 | CSAP 중/상 등급`,
    },
    colorMode: {
      defaultMode: 'light',
      respectPrefersColorScheme: true,
    },
  },
}

export default config
```

---

## 3. k3s 배포 구성

### 3.1 빌드

```bash
# 정적 파일 빌드
cd docs-portal
npm run build
# 빌드 결과: build/ 디렉토리
```

### 3.2 Dockerfile

```dockerfile
FROM nginx:alpine
COPY build/ /usr/share/nginx/html/
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 3000
```

### 3.3 nginx.conf

```nginx
server {
    listen 3000;
    server_name docs.internal;
    root /usr/share/nginx/html;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # 보안 헤더
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline';" always;
}
```

### 3.4 k3s 매니페스트

```yaml
# k8s/docs-portal.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: docs-portal
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: docusaurus
  namespace: docs-portal
spec:
  replicas: 1
  selector:
    matchLabels:
      app: docusaurus
  template:
    metadata:
      labels:
        app: docusaurus
    spec:
      containers:
        - name: docusaurus
          image: harbor.internal/docs/portal:latest
          ports:
            - containerPort: 3000
          resources:
            limits:
              cpu: "200m"
              memory: "128Mi"
            requests:
              cpu: "100m"
              memory: "64Mi"
          securityContext:
            runAsNonRoot: true
            runAsUser: 101
            readOnlyRootFilesystem: true
            allowPrivilegeEscalation: false
          volumeMounts:
            - name: cache
              mountPath: /var/cache/nginx
            - name: run
              mountPath: /var/run
      volumes:
        - name: cache
          emptyDir: {}
        - name: run
          emptyDir: {}
---
apiVersion: v1
kind: Service
metadata:
  name: docusaurus
  namespace: docs-portal
spec:
  type: ClusterIP
  ports:
    - port: 3000
      targetPort: 3000
  selector:
    app: docusaurus
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: docusaurus-ingress
  namespace: docs-portal
spec:
  rules:
    - host: docs.internal
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: docusaurus
                port:
                  number: 3000
```

### 3.5 배포 명령

```bash
# Harbor에 이미지 푸시
docker build -t harbor.internal/docs/portal:latest .
docker push harbor.internal/docs/portal:latest

# k3s 배포
kubectl apply -f k8s/docs-portal.yaml

# 확인
kubectl get pods -n docs-portal
kubectl get ingress -n docs-portal
```

---

## 4. Gitea Actions 자동 빌드/배포

```yaml
# .gitea/workflows/docs-portal-deploy.yml
name: 문서 포털 자동 배포

on:
  push:
    branches: [main]
    paths:
      - 'docs/framework/**'
      - 'docs-portal/**'

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - name: 빌드
        working-directory: docs-portal
        run: |
          npm ci
          npm run build
      - name: Docker 이미지 빌드 및 푸시
        run: |
          docker build -t harbor.internal/docs/portal:${{ github.sha }} docs-portal/
          docker push harbor.internal/docs/portal:${{ github.sha }}
      - name: k3s 배포 업데이트
        run: |
          kubectl set image deployment/docusaurus \
            docusaurus=harbor.internal/docs/portal:${{ github.sha }} \
            -n docs-portal
```

---

## 5. 플러그인 구성

| 플러그인 | 용도 | 설정 |
|---------|------|------|
| `@docusaurus/plugin-content-docs` | 문서 관리 | 다중 사이드바 |
| `docusaurus-plugin-search-local` | 오프라인 전문 검색 | 한국어 토크나이저 |
| `@docusaurus/theme-mermaid` | 아키텍처 다이어그램 | Mermaid.js |

---

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-05 | MTU-A5 Do — Docusaurus 설치/설정/k3s 배포 가이드 작성 | Implementer Agent |
