# MTU-ECO2 — Docusaurus 문서 포털 배포 설정 설계

> **문서 ID**: MTU-ECO2-DESIGN
> **버전**: 1.0.0 | **일자**: 2026-04-06 | **작성자**: PM Agent
> **Plan SC**: FR-ECO2.1~FR-ECO2.5
> **참조**: docs/01-plan/features/mtu-eco2-docusaurus-portal.plan.md

---

## 1. 아키텍처 선택

**선택안**: Pragmatic Balance
- Docusaurus v3 (React 기반 정적 사이트 생성기)
- GitHub Pages 배포 (외부 클라우드 서비스 사용 안 함)
- 로컬 검색 플러그인 (@easyops-cn/docusaurus-search-local)
- docs/ 디렉토리 심볼릭이 아닌 직접 콘텐츠 복사 전략

## 2. 산출물 설계

### 2.1 디렉토리 구조 (FR-ECO2.1)

```
docs-portal/
├── docusaurus.config.js      # 사이트 설정
├── sidebars.js               # 사이드바 카테고리
├── package.json               # 의존성
├── babel.config.js            # Babel 설정
├── docs/                      # 문서 콘텐츠
│   ├── intro.md               # 프레임워크 소개
│   ├── getting-started/       # 빠른 시작
│   │   ├── installation.md
│   │   ├── configuration.md
│   │   └── first-service.md
│   ├── architecture/          # 아키텍처
│   │   ├── overview.md
│   │   ├── multi-tenancy.md
│   │   └── security-model.md
│   ├── csap/                  # CSAP 인증
│   │   ├── overview.md
│   │   ├── 79-items.md
│   │   └── evidence-guide.md
│   ├── isms-p/                # ISMS-P 인증
│   │   ├── overview.md
│   │   ├── 101-items.md
│   │   └── csap-mapping.md
│   ├── plugins/               # 플러그인 개발
│   │   ├── development-guide.md
│   │   └── samples.md
│   └── deployment/            # 배포
│       ├── docker-compose.md
│       ├── k3s.md
│       └── gitea-cicd.md
├── src/
│   ├── pages/
│   │   └── index.tsx          # 랜딩 페이지
│   └── css/
│       └── custom.css         # 커스텀 스타일
└── static/
    └── img/
        └── logo.svg           # 로고
```

### 2.2 사이드바 구성 (FR-ECO2.2)

```javascript
// sidebars.js — 5개 카테고리
module.exports = {
  docs: [
    'intro',
    { type: 'category', label: '시작하기', items: ['getting-started/installation', ...] },
    { type: 'category', label: '아키텍처', items: ['architecture/overview', ...] },
    { type: 'category', label: 'CSAP 인증', items: ['csap/overview', ...] },
    { type: 'category', label: 'ISMS-P 인증', items: ['isms-p/overview', ...] },
    { type: 'category', label: '플러그인', items: ['plugins/development-guide', ...] },
    { type: 'category', label: '배포', items: ['deployment/docker-compose', ...] },
  ],
};
```

### 2.3 GitHub Pages 배포 워크플로우 (FR-ECO2.3)

```yaml
# .github/workflows/docs-deploy.yml
name: Deploy Docs to GitHub Pages
on:
  push:
    branches: [main]
    paths: ['docs-portal/**', 'docs/**']
jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 20 }
      - run: cd docs-portal && npm install && npm run build
      - uses: peaceiris/actions-gh-pages@v4
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: docs-portal/build
```

## 3. 추적성 매트릭스

| FR ID | 설계 섹션 | 산출물 | 검증 |
|-------|---------|--------|------|
| FR-ECO2.1 | 2.1 | docs-portal/ 디렉토리 | 구조 존재 |
| FR-ECO2.2 | 2.2 | sidebars.js | 5개+ 카테고리 |
| FR-ECO2.3 | 2.3 | docs-deploy.yml | 워크플로우 존재 |
| FR-ECO2.4 | 2.1 | index.tsx | 랜딩 페이지 존재 |
| FR-ECO2.5 | 2.1 | docusaurus.config.js | 검색 플러그인 설정 |

## 변경 이력

| 버전 | 일자 | 내용 | 작성자 |
|------|------|------|--------|
| 1.0.0 | 2026-04-06 | 최초 작성 | PM Agent |
