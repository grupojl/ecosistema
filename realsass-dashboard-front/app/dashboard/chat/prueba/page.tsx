'use client';

// app/dashboard/chat/prueba/page.tsx
//
// Página de testing manual contra chat-ia-back — endpoint público del
// asistente por proyecto: POST /projects/:slug/assistant/chat
//
// Deliberadamente NO depende de features/chat/hooks ni de chat-ia-client.ts
// para mantenerse aislada de cualquier contrato interno del dashboard que
// pueda cambiar. Usa el mismo patrón de auth (Bearer Firebase token) que
// @real/auth-client expone para el resto de la app.

import { useCallback, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { getIdToken } from '@real/auth-client';
import { AlertCircle, Bot, Loader2, Send, User as UserIcon } from 'lucide-react';
import { Button } from '@real/ui';
import { Input } from '@real/ui';
import { Label } from '@real/ui';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@real/ui';

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
  const [organizationId, setOrganizationId] = useState('');
  const [projectSlug, setProjectSlug] = useState('mi-primer-proyecto');
  const [userId] = useState<string>(genUserId);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;

    if (!organizationId.trim()) {
      setError('Falta el Organization ID.');
      return;
    }

    setError(null);
    setMessages((prev) => [...prev, { role: 'user', content: text }]);
    setInput('');
    setSending(true);

    try {
      const token = await getIdToken();

      const res = await fetch(
        `${CHAT_IA_URL}/api/v1/projects/${encodeURIComponent(projectSlug)}/assistant/chat`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'x-organization-id': organizationId.trim(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ userId, message: text }),
        },
      );

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
  }, [input, sending, organizationId, projectSlug, userId]);

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 p-4 sm:p-6">
      <div>
        <h1 className="text-xl font-semibold">Prueba del Asistente IA</h1>
        <p className="text-sm text-muted-foreground">
          Página de testing directo contra chat-ia-back ({CHAT_IA_URL}). No
          persiste nada fuera de la sesión del asistente en el propio backend.
        </p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Configuración</CardTitle>
          <CardDescription>User ID de prueba: {userId}</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="org-id">Organization ID</Label>
            <Input
              id="org-id"
              value={organizationId}
              onChange={(e) => setOrganizationId(e.target.value)}
              placeholder="f8a5c145-6058-4fcd-8c42-30f9b4e0c792"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="project-slug">Project slug</Label>
            <Input
              id="project-slug"
              value={projectSlug}
              onChange={(e) => setProjectSlug(e.target.value)}
              placeholder="mi-primer-proyecto"
            />
          </div>
        </CardContent>
      </Card>

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
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-secondary'
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
            <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
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
    </div>
  );
}
