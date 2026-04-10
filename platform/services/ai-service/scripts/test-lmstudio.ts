#!/usr/bin/env tsx
// LM Studio 연결 테스트 스크립트
// 사용법: LLM_API_KEY=<토큰> tsx scripts/test-lmstudio.ts
//
// LM Studio 토큰 발급:
//   LM Studio → Settings (⚙) → Local Server → API Keys → Generate Key
//
// CSAP: 이 스크립트는 O등급 테스트 데이터만 사용합니다

const BASE_URL = process.env['LLM_BASE_URL'] ?? 'http://192.168.0.104:1234';
const API_KEY = process.env['LLM_API_KEY'] ?? '';
const MODEL = process.env['LLM_MODEL'] ?? 'google/gemma-4-26b-a4b';

const headers: Record<string, string> = {
  'Content-Type': 'application/json',
  ...(API_KEY ? { Authorization: `Bearer ${API_KEY}` } : {}),
};

async function checkModels(): Promise<void> {
  console.log('\n[1/3] LM Studio 모델 목록 조회...');
  const res = await fetch(`${BASE_URL}/v1/models`, { headers });
  const body = await res.json() as { data?: { id: string }[]; error?: { message: string } };

  if (!res.ok || body.error) {
    console.error('  FAIL:', body.error?.message ?? `HTTP ${res.status}`);
    if (body.error?.message.includes('token')) {
      console.error('\n  ▶ LM Studio API 토큰이 필요합니다:');
      console.error('    LM Studio → Settings → Local Server → API Keys → Generate Key');
      console.error(`    LLM_API_KEY=<토큰> tsx scripts/test-lmstudio.ts`);
    }
    process.exit(1);
  }

  const models = body.data ?? [];
  console.log(`  OK: 로드된 모델 ${models.length}개`);
  models.forEach((m) => console.log(`    - ${m.id}`));
}

async function testTextChat(): Promise<void> {
  console.log('\n[2/3] 텍스트 채팅 테스트...');
  // Thinking 모델(gemma-4, qwen3 등)은 추론에 많은 토큰을 사용하므로 max_tokens 충분히 설정
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: '당신은 공공기관 SaaS 플랫폼 AI 어시스턴트입니다.' },
        { role: 'user', content: '안녕하세요. 한 문장으로 자기소개 해주세요.' },
      ],
      max_tokens: 4096,
      temperature: 0.7,
      stream: false,
    }),
  });

  const body = await res.json() as {
    choices?: { message: { content: string } }[];
    usage?: { total_tokens: number };
    model?: string;
    error?: { message: string };
  };

  if (!res.ok || body.error) {
    console.error('  FAIL:', body.error?.message ?? `HTTP ${res.status}`);
    process.exit(1);
  }

  const reply = body.choices?.[0]?.message.content ?? '(응답 없음)';
  console.log(`  OK: 응답 수신 (${body.usage?.total_tokens ?? '?'}토큰)`);
  console.log(`  응답: "${reply.slice(0, 120)}${reply.length > 120 ? '...' : ''}"`);
}

async function testImageChat(): Promise<void> {
  console.log('\n[3/3] 멀티모달(이미지) 테스트...');

  // 1x1 흰색 PNG (base64) — 실제 이미지 대신 최소 데이터로 API 형식만 검증
  const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI6QAAAABJRU5ErkJggg==';

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: 'user',
          content: [
            { type: 'text', text: '이미지를 확인해주세요. 무엇이 보이나요?' },
            { type: 'image_url', image_url: { url: `data:image/png;base64,${tinyPng}` } },
          ],
        },
      ],
      max_tokens: 100,
      stream: false,
    }),
  });

  const body = await res.json() as {
    choices?: { message: { content: string } }[];
    error?: { message: string };
  };

  if (!res.ok || body.error) {
    // 모델이 멀티모달 미지원 시 graceful 처리
    const msg = body.error?.message ?? `HTTP ${res.status}`;
    if (msg.toLowerCase().includes('vision') || msg.toLowerCase().includes('image') || res.status === 400) {
      console.warn(`  WARN: 이미지 미지원 모델이거나 형식 불일치 — ${msg.slice(0, 100)}`);
      console.warn('  google/gemma-4-26b-a4b 모델이 LM Studio에 로드되어 있는지 확인하세요.');
    } else {
      console.error('  FAIL:', msg);
    }
    return;
  }

  const reply = body.choices?.[0]?.message.content ?? '(응답 없음)';
  console.log(`  OK: 멀티모달 응답 수신`);
  console.log(`  응답: "${reply.slice(0, 120)}${reply.length > 120 ? '...' : ''}"`);
}

async function main(): Promise<void> {
  console.log('════════════════════════════════════════');
  console.log(' LM Studio 연결 테스트');
  console.log(`  URL  : ${BASE_URL}`);
  console.log(`  모델 : ${MODEL}`);
  console.log(`  인증 : ${API_KEY ? '토큰 있음' : '토큰 없음 (인증 비활성화 시 가능)'}`);
  console.log('════════════════════════════════════════');

  await checkModels();
  await testTextChat();
  await testImageChat();

  console.log('\n════════════════════════════════════════');
  console.log(' 테스트 완료 — LM Studio 연결 정상');
  console.log('════════════════════════════════════════\n');
}

main().catch((err: unknown) => {
  console.error('\n연결 실패:', err instanceof Error ? err.message : String(err));
  console.error('LM Studio 서버가 실행 중인지 확인하세요:', BASE_URL);
  process.exit(1);
});
