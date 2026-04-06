import React from 'react';
import clsx from 'clsx';
import Layout from '@theme/Layout';
import Link from '@docusaurus/Link';
import styles from './index.module.css';

// Design Ref: MTU-ECO2 Design 2.1
// Plan SC: FR-ECO2.4

const features = [
  {
    title: 'CSAP 인증 지원',
    description: 'CSAP 표준등급 79개 통제항목 증적 자동 매핑. OSCAL v1.1.3 호환 검증 스크립트 포함.',
  },
  {
    title: 'ISMS-P 대응',
    description: '101항목 체크리스트 + CSAP 45항목 증적 재활용. 2027-07 의무화 대비.',
  },
  {
    title: '멀티테넌시',
    description: '기관별 격리된 테넌트 환경. RBAC 기반 세분화된 접근 통제.',
  },
  {
    title: '마이크로서비스',
    description: '15개 독립 서비스. Hono 경량 HTTP 프레임워크. Docker/k3s 배포.',
  },
  {
    title: 'AI 연동',
    description: 'LM Studio 로컬 LLM 연동. N2SF 데이터 등급 자동 분류. 외부 클라우드 의존 없음.',
  },
  {
    title: '감리 대응',
    description: '행안부 감리기준 산출물 7종(T01~T07) 완비. PDCA 워크플로우 내장.',
  },
];

function Feature({ title, description }: { title: string; description: string }) {
  return (
    <div className={clsx('col col--4')}>
      <div className="padding-horiz--md padding-vert--lg">
        <h3>{title}</h3>
        <p>{description}</p>
      </div>
    </div>
  );
}

function HomepageHeader() {
  return (
    <header className={clsx('hero hero--primary', styles.heroBanner)}>
      <div className="container">
        <h1 className="hero__title">공공기관 SaaS 프레임워크</h1>
        <p className="hero__subtitle">CSAP/ISMS-P 인증 지원 SaaS 플랫폼</p>
        <div className={styles.buttons}>
          <Link className="button button--secondary button--lg" to="/docs/getting-started/installation">
            빠른 시작 (5분)
          </Link>
        </div>
      </div>
    </header>
  );
}

export default function Home(): React.ReactElement {
  return (
    <Layout title="홈" description="공공기관 클라우드 전환을 위한 CSAP/ISMS-P 인증 지원 SaaS 프레임워크">
      <HomepageHeader />
      <main>
        <section className={styles.features}>
          <div className="container">
            <div className="row">
              {features.map((props, idx) => (
                <Feature key={idx} {...props} />
              ))}
            </div>
          </div>
        </section>
      </main>
    </Layout>
  );
}
