import { useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Loader2, Send, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { MarkdownBody } from "../components/MarkdownBody";
import { useCompany } from "../context/CompanyContext";
import { ApiError } from "../api/client";
import { ceoApi, type CeoAskResponse } from "../api/ceo";
import { replaceWikilinks } from "../lib/wikilinks";

interface ChatTurn {
  id: string;
  question: string;
  answer?: CeoAskResponse;
  error?: string;
  pending: boolean;
  startedAt: number;
  endedAt?: number;
}

function newId() {
  return `turn-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function CeoAsk() {
  const { selectedCompany } = useCompany();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const mutation = useMutation({
    mutationFn: async (q: string) => {
      if (!selectedCompany) throw new Error("No company selected");
      return ceoApi.ask(selectedCompany.id, { question: q });
    },
  });

  const isBusy = mutation.isPending;
  const canSubmit = !isBusy && question.trim().length > 0 && !!selectedCompany;

  const submit = async () => {
    const q = question.trim();
    if (!q || !selectedCompany) return;
    const id = newId();
    const startedAt = Date.now();
    setTurns((prev) => [...prev, { id, question: q, pending: true, startedAt }]);
    setQuestion("");
    try {
      const answer = await mutation.mutateAsync(q);
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, answer, pending: false, endedAt: Date.now() } : t,
        ),
      );
    } catch (err) {
      const message =
        err instanceof ApiError
          ? `${err.status}: ${err.message}`
          : err instanceof Error
            ? err.message
            : "Unknown error";
      setTurns((prev) =>
        prev.map((t) =>
          t.id === id ? { ...t, error: message, pending: false, endedAt: Date.now() } : t,
        ),
      );
    } finally {
      inputRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      if (canSubmit) void submit();
    }
  };

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4 py-6">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-border bg-card p-2">
          <Sparkles className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Спросить Гендира</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Задай вопрос по истории компании. Ответ опирается на decisions-log и vault
            через локальный Qwen3 + Obsidian. Цитаты как <code>[[wikilinks]]</code>{" "}
            открываются в Obsidian.
          </p>
        </div>
      </div>

      {!selectedCompany ? (
        <Card>
          <CardContent className="py-6 text-sm text-muted-foreground">
            Выбери компанию в сайдбаре, чтобы задать вопрос.
          </CardContent>
        </Card>
      ) : null}

      <div className="flex flex-col gap-4">
        {turns.map((turn) => (
          <ChatTurnCard key={turn.id} turn={turn} />
        ))}
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Новый вопрос
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2">
          <Textarea
            ref={inputRef}
            placeholder="Например: Когда designer сдал v2 калькулятор?"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={onKeyDown}
            rows={3}
            disabled={!selectedCompany || isBusy}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Ctrl/⌘ + Enter — отправить
            </p>
            <Button onClick={() => void submit()} disabled={!canSubmit}>
              {isBusy ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Думаю…
                </>
              ) : (
                <>
                  <Send className="mr-2 h-4 w-4" />
                  Отправить
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ChatTurnCard({ turn }: { turn: ChatTurn }) {
  const renderedAnswer = useMemo(() => {
    if (!turn.answer?.answer) return "";
    return replaceWikilinks(turn.answer.answer);
  }, [turn.answer?.answer]);

  const elapsedMs =
    turn.endedAt && turn.startedAt ? turn.endedAt - turn.startedAt : undefined;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 py-4">
        <div className="rounded-md bg-muted/50 px-3 py-2 text-sm">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Вопрос
          </div>
          <p className="mt-1 whitespace-pre-wrap">{turn.question}</p>
        </div>
        {turn.pending ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Гендир думает…
          </div>
        ) : turn.error ? (
          <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            <div className="text-[11px] font-semibold uppercase tracking-wide">Ошибка</div>
            <p className="mt-1">{turn.error}</p>
          </div>
        ) : turn.answer ? (
          <div className="flex flex-col gap-2">
            <MarkdownBody>{renderedAnswer}</MarkdownBody>
            <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
              {turn.answer.model ? <span>модель: {turn.answer.model}</span> : null}
              {typeof turn.answer.durationMs === "number" ? (
                <span>backend: {Math.round(turn.answer.durationMs)} мс</span>
              ) : null}
              {typeof elapsedMs === "number" ? (
                <span>e2e: {Math.round(elapsedMs)} мс</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
