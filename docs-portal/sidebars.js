/** @type {import('@docusaurus/plugin-content-docs').SidebarsConfig} */
const sidebars = {
  docs: [
    'intro',
    {
      type: 'category',
      label: '시작하기',
      items: [
        'getting-started/installation',
        'getting-started/configuration',
        'getting-started/first-service',
      ],
    },
    {
      type: 'category',
      label: '아키텍처',
      items: [
        'architecture/overview',
        'architecture/multi-tenancy',
        'architecture/security-model',
      ],
    },
    {
      type: 'category',
      label: 'CSAP 인증',
      items: [
        'csap/overview',
        'csap/79-items',
        'csap/evidence-guide',
      ],
    },
    {
      type: 'category',
      label: 'ISMS-P 인증',
      items: [
        'isms-p/overview',
        'isms-p/101-items',
        'isms-p/csap-mapping',
      ],
    },
    {
      type: 'category',
      label: '플러그인 개발',
      items: [
        'plugins/development-guide',
        'plugins/samples',
      ],
    },
    {
      type: 'category',
      label: '배포',
      items: [
        'deployment/docker-compose',
        'deployment/k3s',
        'deployment/gitea-cicd',
      ],
    },
  ],
};

module.exports = sidebars;
