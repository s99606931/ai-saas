/**
 * DORA 4 Metrics Exporter
 * Design Ref: docs/02-design/mtus/MTU-N169-dora-metrics.design.md §3
 * Plan SC: FR-DORA.1, FR-DORA.2, FR-DORA.3, FR-DORA.4, FR-DORA.5
 *
 * Gitea webhook 이벤트 + AlertManager webhook을 수신하여
 * DORA 4대 지표를 Prometheus 메트릭으로 노출하는 익스포터
 */

import express from 'express';
import { Registry, Counter, Histogram, Gauge, collectDefaultMetrics } from 'prom-client';
import { z } from 'zod';
import { DORAClassifier, DORALevel } from './classifier';
import { LeadTimeCalculator } from './lead-time';
import { ChangeFailureDetector } from './change-failure';
import { MTTRTracker } from './mttr-tracker';

// Design Ref: §3.5 - Prometheus 메트릭 정의
const register = new Registry();
collectDefaultMetrics({ register });

// FR-DORA.1: 배포 빈도 카운터
const deploymentTotal = new Counter({
  name: 'dora_deployment_total',
  help: '배포 횟수 (DORA Deployment Frequency)',
  labelNames: ['team', 'service', 'environment'] as const,
  registers: [register],
});

// FR-DORA.2: 변경 리드타임 히스토그램
const leadTimeSeconds = new Histogram({
  name: 'dora_lead_time_seconds',
  help: '변경 리드타임 - 첫 커밋에서 프로덕션 배포까지 (초)',
  labelNames: ['team', 'service'] as const,
  buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400, 604800],
  registers: [register],
});

// FR-DORA.3: 변경 실패율 게이지
const changeFailureRate = new Gauge({
  name: 'dora_change_failure_rate',
  help: '변경 실패율 (0.0 ~ 1.0)',
  labelNames: ['team', 'service'] as const,
  registers: [register],
});

// FR-DORA.4: 서비스 복구 시간 히스토그램
const mttrSeconds = new Histogram({
  name: 'dora_mttr_seconds',
  help: '서비스 복구 시간 (초)',
  labelNames: ['team', 'service', 'severity'] as const,
  buckets: [60, 300, 900, 1800, 3600, 7200, 14400, 28800, 86400],
  registers: [register],
});

// FR-DORA.8: DORA 등급 게이지
const teamLevel = new Gauge({
  name: 'dora_team_level',
  help: 'DORA 등급 (0=Low, 1=Medium, 2=High, 3=Elite)',
  labelNames: ['team'] as const,
  registers: [register],
});

// Zod 입력 검증 스키마 (CSAP D-12 준수)
const giteaWebhookSchema = z.object({
  ref: z.string(),
  after: z.string(),
  repository: z.object({
    full_name: z.string(),
  }),
  commits: z.array(z.object({
    id: z.string(),
    timestamp: z.string(),
    message: z.string(),
  })),
  pusher: z.object({
    login: z.string(),
  }),
});

const alertManagerSchema = z.object({
  status: z.enum(['firing', 'resolved']),
  alerts: z.array(z.object({
    status: z.enum(['firing', 'resolved']),
    labels: z.record(z.string()),
    startsAt: z.string(),
    endsAt: z.string().optional(),
    annotations: z.record(z.string()).optional(),
  })),
});

const app = express();
app.use(express.json({ limit: '1mb' }));

const leadTimeCalculator = new LeadTimeCalculator();
const changeFailureDetector = new ChangeFailureDetector();
const mttrTracker = new MTTRTracker();
const classifier = new DORAClassifier();

/**
 * Gitea Webhook 수신 엔드포인트
 * Design Ref: §3.1, §3.2, §3.3
 */
app.post('/webhook/gitea', async (req, res) => {
  try {
    const payload = giteaWebhookSchema.parse(req.body);
    const repoName = payload.repository.full_name;
    const team = extractTeam(repoName);
    const service = extractService(repoName);
    const environment = extractEnvironment(payload.ref);

    // FR-DORA.1: 배포 빈도 증가
    if (isDeploymentEvent(payload.ref)) {
      deploymentTotal.inc({ team, service, environment });

      // FR-DORA.2: 리드타임 계산
      const firstCommitTime = getFirstCommitTimestamp(payload.commits);
      if (firstCommitTime) {
        const deployTime = Date.now();
        const leadTime = leadTimeCalculator.calculate(firstCommitTime, deployTime);
        leadTimeSeconds.observe({ team, service }, leadTime);
      }

      // FR-DORA.3: 변경 실패 감지
      const isFailure = changeFailureDetector.detect(payload.commits);
      if (isFailure) {
        changeFailureDetector.recordFailure(team, service);
      } else {
        changeFailureDetector.recordSuccess(team, service);
      }
      const rate = changeFailureDetector.getRate(team, service);
      changeFailureRate.set({ team, service }, rate);
    }

    res.status(200).json({ status: 'accepted' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid webhook payload', details: error.issues });
      return;
    }
    console.error('Webhook processing error:', (error as Error).message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * AlertManager Webhook 수신 엔드포인트
 * Design Ref: §3.4
 */
app.post('/webhook/alertmanager', async (req, res) => {
  try {
    const payload = alertManagerSchema.parse(req.body);

    for (const alert of payload.alerts) {
      const service = alert.labels.service || 'unknown';
      const team = alert.labels.team || 'unknown';
      const severity = alert.labels.severity || 'warning';

      if (alert.status === 'firing') {
        // FR-DORA.4: 장애 시작 기록
        mttrTracker.recordIncidentStart(service, team, alert.startsAt);
      } else if (alert.status === 'resolved') {
        // FR-DORA.4: 복구 시간 계산
        const recoveryTime = mttrTracker.recordIncidentEnd(
          service, team, alert.endsAt || new Date().toISOString()
        );
        if (recoveryTime !== null) {
          mttrSeconds.observe({ team, service, severity }, recoveryTime);
        }
      }
    }

    res.status(200).json({ status: 'accepted' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: 'Invalid alert payload', details: error.issues });
      return;
    }
    console.error('Alert processing error:', (error as Error).message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DORA 등급 업데이트 엔드포인트
 * Design Ref: §3.8
 */
app.post('/classify', async (_req, res) => {
  try {
    const teams = changeFailureDetector.getTeams();
    const results: Record<string, DORALevel> = {};

    for (const team of teams) {
      const level = classifier.classify({
        deploymentFrequency: await getDeploymentRate(team),
        leadTimeSeconds: await getMedianLeadTime(team),
        changeFailureRate: changeFailureDetector.getTeamRate(team),
        mttrSeconds: mttrTracker.getMedianMTTR(team),
      });
      teamLevel.set({ team }, level);
      results[team] = level;
    }

    res.status(200).json({ results });
  } catch (error) {
    console.error('Classification error:', (error as Error).message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Prometheus 메트릭 엔드포인트
app.get('/metrics', async (_req, res) => {
  try {
    res.set('Content-Type', register.contentType);
    res.end(await register.metrics());
  } catch (error) {
    res.status(500).end();
  }
});

// 헬스체크 엔드포인트
app.get('/healthz', (_req, res) => {
  res.status(200).json({ status: 'ok', version: '1.0.0' });
});

// 유틸리티 함수
function extractTeam(repoName: string): string {
  const parts = repoName.split('/');
  return parts[0] || 'default';
}

function extractService(repoName: string): string {
  const parts = repoName.split('/');
  return parts[1] || 'unknown';
}

function extractEnvironment(ref: string): string {
  if (ref.includes('main') || ref.includes('master')) return 'production';
  if (ref.includes('stg') || ref.includes('staging')) return 'staging';
  if (ref.includes('dev')) return 'development';
  return 'other';
}

function isDeploymentEvent(ref: string): boolean {
  return ref.includes('main') || ref.includes('master') ||
         ref.includes('stg') || ref.includes('staging') ||
         ref.includes('refs/tags/v');
}

function getFirstCommitTimestamp(
  commits: Array<{ timestamp: string }>
): number | null {
  if (commits.length === 0) return null;
  const timestamps = commits.map(c => new Date(c.timestamp).getTime());
  return Math.min(...timestamps);
}

async function getDeploymentRate(team: string): Promise<number> {
  // 최근 30일 배포 횟수 / 30 = 일평균 배포 빈도
  const metric = await register.getSingleMetricAsString('dora_deployment_total');
  const lines = metric.split('\n').filter(l => l.includes(`team="${team}"`));
  let total = 0;
  for (const line of lines) {
    const match = line.match(/(\d+)$/);
    if (match) total += parseInt(match[1], 10);
  }
  return total / 30;
}

async function getMedianLeadTime(team: string): Promise<number> {
  return leadTimeCalculator.getMedian(team);
}

const PORT = parseInt(process.env.DORA_EXPORTER_PORT || '9170', 10);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`DORA Exporter listening on port ${PORT}`);
  console.log('Endpoints: /webhook/gitea, /webhook/alertmanager, /metrics, /healthz');
});

export { app, register };
