'use client';

// app/(panel)/chat/prueba/page.tsx
//
// Página de testing manual contra chat-ia-back — endpoint público del
// asistente por organización: POST /api/v1/assistant/chat
//
// Deliberadamente NO depende de features/chat/hooks ni de chat-ia-client.ts
// para mantenerse aislada de cualquier contrato interno del dashboard que
// pueda cambiar. Usa el mismo patrón de auth (Bearer Firebase token) que
// @real/auth-client expone para el resto de la app.

import { Alert, PageContainer, PageHeader } from '@real/ui'
import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { getIdToken } from '@real/auth-client';
import { useActiveOrganization } from '@/features/auth/hooks/use-active-organization';
import { CircleAlert, Bot, Loader2, Send, User as UserIcon } from 'lucide-react';
import { Button } from '@real/ui';
import { Input } from '@real/ui';
import { Card, CardContent } from '@real/ui';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AssistantChatResponse {
  sessionId: string;
  response: string;
  tokensUsed: number;
  modelUsed: string;
  usedFaqFallback: boolean;
  faqSources?: unknown[];
}

const CHAT_IA_URL =
  process.env.NEXT_PUBLIC_CHAT_IA_URL ??
  'https://chatia-backend-production.up.railway.app';

function genUserId(): string {
  return `user-test-${Math.random().toString(36).slice(2, 8)}`;
}

export default function PruebaAsistentePage() {
  // La tienda activa define el organizationId; el back resuelve el asistente por
  // organización (sin projectSlug).
  const { organization } = useActiveOrganization();
  const organizationId = organization?.id ?? '';

  const [userId] = useState<string>(genUserId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (!organizationId) {
      setError('Todavía no hay una tienda activa.');
      return;
    }

    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const token = await getIdToken();

      const res = await fetch(`${CHAT_IA_URL}/api/v1/assistant/chat`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'x-organization-id': organizationId,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ userId, message: text }),
      });

      if (!res.ok) {
        let msg = `Error ${res.status}`;
        try {
          const body = (await res.json()) as { message?: string };
          if (body?.message) msg = body.message;
        } catch {
          /* sin body */
        }
        throw new Error(msg);
      }

      const data = (await res.json()) as AssistantChatResponse;
      setMessages((prev) => [...prev, { role: 'assistant', content: data.response }]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido al enviar el mensaje');
    } finally {
      setSending(false);
    }
  }, [input, sending, organizationId, userId]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <PageContainer size="sm" className="space-y-4">
      <PageHeader
        title="Prueba del Asistente IA"
        description={`Página de testing directo contra chat-ia-back (${CHAT_IA_URL}). No persiste nada fuera de la sesión del asistente en el propio backend.`}
      />

      <p className="text-sm text-muted-foreground">
        Asistente de <span className="font-medium text-foreground">{organization?.name || organization?.slug || '...'}</span>
      </p>

      <Card>
        <CardContent className="flex flex-col gap-3 p-4">
          <div className="flex min-h-[320px] flex-col gap-3 overflow-y-auto rounded-md border bg-muted/30 p-3">
            {messages.length === 0 && (
              <p className="m-auto text-sm text-muted-foreground">
                Escribí un mensaje para empezar a probar el asistente.
              </p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`flex items-start gap-2 ${m.role === 'user' ? 'flex-row-reverse' : ''}`}
              >
                <div
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
                  }`}
                >
                  {m.role === 'user' ? (
                    <UserIcon className="h-4 w-4" />
                  ) : (
                    <Bot className="h-4 w-4" />
                  )}
                </div>
                <div
                  className={`max-w-[80%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'border bg-background'
                  }`}
                >
                  {m.content}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                El asistente está escribiendo...
              </div>
            )}
          </div>

          {error && (
            <Alert variant="destructive">{error}</Alert>
          )}

          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribí tu mensaje..."
              disabled={sending}
            />
            <Button onClick={() => void sendMessage()} disabled={sending || !input.trim()}>
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageContainer>
  );
}
