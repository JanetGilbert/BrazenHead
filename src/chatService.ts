/**
 * Chat service — sends conversation messages to the HuggingFace LLM
 * via the server-side /api/chat proxy and returns the assistant reply.
 */

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const SYSTEM_PROMPT: ChatMessage = {
  role: 'system',
  content:
    'You are the Brazen Head, an ancient bronze oracle. ' +
    'You speak in a deep, resonant voice. Your responses are brief and cryptic — ' +
    'one to three sentences at most. You answer questions with mysterious wisdom, ' +
    'riddles, or stern pronouncements. Never break character.',
};

/**
 * Send a conversation to the chat proxy and return the assistant's reply.
 */
export async function sendChat(messages: ChatMessage[]): Promise<string> {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || body.error || `Chat request failed (${res.status})`);
  }

  const data = await res.json();
  return data.reply ?? '';
}
