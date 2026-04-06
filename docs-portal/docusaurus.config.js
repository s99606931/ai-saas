// @ts-check
/** @type {import('@docusaurus/types').Config} */
const config = {
  title: '공공기관 SaaS 프레임워크',
  tagline: 'CSAP/ISMS-P 인증 지원 SaaS 플랫폼',
  favicon: 'img/favicon.ico',

  url: 'https://your-org.github.io',
  baseUrl: '/public-saas-framework/',

  organizationName: 'your-org',
  projectName: 'public-saas-framework',

  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',

  i18n: {
    defaultLocale: 'ko',
    locales: ['ko'],
  },

  presets: [
    [
      'classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarPath: require.resolve('./sidebars.js'),
          editUrl: 'https://github.com/your-org/public-saas-framework/tree/main/docs-portal/',
        },
        theme: {
          customCss: require.resolve('./src/css/custom.css'),
        },
      }),
    ],
  ],

  themes: [
    [
      require.resolve('@easyops-cn/docusaurus-search-local'),
      /** @type {import("@easyops-cn/docusaurus-search-local").PluginOptions} */
      ({
        hashed: true,
        language: ['ko', 'en'],
        indexDocs: true,
        indexBlog: false,
        docsRouteBasePath: '/docs',
      }),
    ],
  ],

  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      navbar: {
        title: '공공 SaaS 프레임워크',
        items: [
          {
            type: 'docSidebar',
            sidebarId: 'docs',
            position: 'left',
            label: '문서',
          },
          {
            href: 'https://github.com/your-org/public-saas-framework',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      footer: {
        style: 'dark',
        links: [
          {
            title: '문서',
            items: [
              { label: '시작하기', to: '/docs/getting-started/installation' },
              { label: 'CSAP 인증', to: '/docs/csap/overview' },
              { label: 'ISMS-P 인증', to: '/docs/isms-p/overview' },
            ],
          },
          {
            title: '커뮤니티',
            items: [
              { label: 'GitHub', href: 'https://github.com/your-org/public-saas-framework' },
              { label: '이슈 등록', href: 'https://github.com/your-org/public-saas-framework/issues' },
            ],
          },
        ],
        copyright: `Copyright ${new Date().getFullYear()} Public SaaS Framework Contributors. MIT License.`,
      },
    }),
};

module.exports = config;
