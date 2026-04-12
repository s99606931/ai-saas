// AI Chat Widget — SSE 스트리밍 채팅 — MTU-N551
// Design Ref: SVC-AI-R3 DESIGN §1, FR-AI-R3.1
// Plan SC: FR-UP.AI.1
// CSAP: D-08 인증 (서버 게이트웨이 경유), N2SF: O등급만 전송

'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

interface AIChatWidgetProps {
  modelId: string;
  tenantId: string;
  systemPrompt?: string;
  onClose?: () => void;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export function AIChatWidget({ modelId, tenantId, systemPrompt, onClose }: AIChatWidgetProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    if (!input.trim() || isStreaming) return;

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
    };
    const assistantMsg: ChatMessage = {
      id: `a_${Date.now()}`,
      role: 'assistant',
      content: '',
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput('');
    setIsStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const apiBase = process.env.NEXT_PUBLIC_API_GATEWAY_URL ?? '';
      const response = await fetch(`${apiBase}/api/ai/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          tenantId,
          message: userMsg.content,
          grade: 'O',
          systemPrompt,
        }),
        signal: controller.signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`HTTP ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const data = line.slice(6).trim();
          if (data === '[DONE]') break;
          try {
            const chunk = JSON.parse(data) as { delta?: string };
            if (chunk.delta) {
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantMsg.id ? { ...m, content: m.content + chunk.delta } : m,
                ),
              );
            }
          } catch {
            // Ignore non-JSON keep-alive
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id ? { ...m, content: '오류가 발생했습니다. 다시 시도해주세요.' } : m,
          ),
        );
      }
    } finally {
      setIsStreaming(false);
      abortRef.current = null;
    }
  }, [input, isStreaming, modelId, tenantId, systemPrompt]);

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort();
    setIsStreaming(false);
  }, []);

  return (
    <div
      className="flex flex-col h-full border rounded-lg"
      style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)' }}
      role="region"
      aria-label="AI 채팅 위젯"
    >
      <div
        className="flex items-center justify-between px-3 py-2 border-b"
        style={{ borderColor: 'var(--color-border)' }}
      >
        <span className="text-sm font-semibold" style={{ color: 'var(--color-text)' }}>
          AI 어시스턴트
        </span>
        {onClose && (
          <button onClick={onClose} className="text-xs" aria-label="닫기">
            닫기
          </button>
        )}
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 && (
          <p className="text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
            질문을 입력하여 대화를 시작하세요.
          </p>
        )}
        {messages.map((m) => (
          <div
            key={m.id}
            className={`text-sm p-2 rounded-lg ${m.role === 'user' ? 'ml-8' : 'mr-8'}`}
            style={{
              backgroundColor: m.role === 'user' ? 'var(--color-primary-soft)' : 'var(--color-bg-secondary)',
              color: 'var(--color-text)',
            }}
          >
            {m.content || '...'}
          </div>
        ))}
      </div>

      <div className="p-3 border-t" style={{ borderColor: 'var(--color-border)' }}>
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="질문을 입력하세요..."
            disabled={isStreaming}
            className="flex-1 px-3 py-2 text-sm border rounded-lg"
            style={{ borderColor: 'var(--color-border)', backgroundColor: 'var(--color-bg)', color: 'var(--color-text)' }}
            aria-label="질문 입력"
          />
          {isStreaming ? (
            <button
              onClick={stopStreaming}
              className="px-3 py-2 text-sm rounded-lg"
              style={{ backgroundColor: 'var(--color-warning)', color: '#fff' }}
            >
              중지
            </button>
          ) : (
            <button
              onClick={sendMessage}
              disabled={!input.trim()}
              className="px-3 py-2 text-sm rounded-lg disabled:opacity-50"
              style={{ backgroundColor: 'var(--color-primary)', color: '#fff' }}
            >
              전송
            </button>
          )}
        </div>
        <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
          N2SF: O등급 데이터만 전송됩니다.
        </p>
      </div>
    </div>
  );
}
