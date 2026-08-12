"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { ArrowUp, RotateCcw, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  LOCAL_ASSISTANT_PROMPT_GROUPS,
  buildOpeningReplies,
  resolveLocalAssistantReply,
  type LocalAssistantContext,
} from "@/lib/ai/local-assistant";
import { submitAssistantFeedback } from "@/app/assistant/actions";

type AssistantMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  suggestions?: string[];
  // The user question that prompted this assistant reply (used when the user
  // rates the reply so the saved feedback has context). Absent on seed messages.
  sourceQuestion?: string;
};

type FeedbackState = "up" | "down" | "sending";

function uniqueStrings(values: string[] | undefined) {
  const seen = new Set<string>();
  return (values ?? []).filter((value) => {
    const normalized = value.trim().toLowerCase();
    if (!normalized || seen.has(normalized)) return false;
    seen.add(normalized);
    return true;
  });
}

function MessageContent({ content }: { content: string }) {
  // Render paragraphs separated by blank lines, bold text (**word**)
  const paragraphs = content.split(/\n{2,}/);
  return (
    <div className="space-y-2">
      {paragraphs.map((para, i) => {
        // Handle line breaks within a paragraph
        const lines = para.split("\n");
        return (
          <p key={i} className="text-sm leading-relaxed">
            {lines.map((line, j) => {
              // Bold: **text**
              const parts = line.split(/(\*\*[^*]+\*\*)/g);
              return (
                <span key={j}>
                  {parts.map((part, k) =>
                    part.startsWith("**") && part.endsWith("**") ? (
                      <strong key={k}>{part.slice(2, -2)}</strong>
                    ) : (
                      <span key={k}>{part}</span>
                    )
                  )}
                  {j < lines.length - 1 && <br />}
                </span>
              );
            })}
          </p>
        );
      })}
    </div>
  );
}

export function AppAssistant({
  context,
  viewer: _viewer,
}: {
  context: LocalAssistantContext;
  viewer: { name: string | null; email: string };
}) {
  const messageCounterRef = useRef(2);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const initialMessages = useMemo<AssistantMessage[]>(
    () =>
      buildOpeningReplies(context).map((message, index) => ({
        id: `assistant-seed-${index + 1}`,
        role: "assistant" as const,
        content: message.content,
        suggestions: uniqueStrings(message.suggestions),
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  const suggestedPrompts = useMemo(() => {
    const seen = new Set<string>();
    const prompts: Array<{ id: string; label: string; message: string }> = [];
    for (const group of LOCAL_ASSISTANT_PROMPT_GROUPS) {
      for (const p of group.prompts) {
        const key = p.message.trim().toLowerCase();
        if (!key || seen.has(key) || prompts.length >= 6) continue;
        seen.add(key);
        prompts.push(p);
      }
    }
    return prompts;
  }, []);

  const [messages, setMessages] = useState<AssistantMessage[]>(() => initialMessages);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  // Per-message reply rating, keyed by message id.
  const [feedback, setFeedback] = useState<Record<string, FeedbackState>>({});
  const chatStarted = messages.some((m) => m.role === "user");

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  useEffect(() => {
    const textarea = inputRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 160)}px`;
  }, [input]);

  function nextId() {
    messageCounterRef.current += 1;
    return `msg-${messageCounterRef.current}`;
  }

  async function sendMessage(rawValue: string) {
    const content = rawValue.trim();
    if (!content || loading) return;

    setMessages((prev) => [...prev, { id: nextId(), role: "user", content }]);
    setInput("");
    setLoading(true);

    await new Promise((resolve) => window.setTimeout(resolve, 120));

    const reply = resolveLocalAssistantReply(content, context);
    setMessages((prev) => [
      ...prev,
      {
        id: nextId(),
        role: "assistant",
        content: reply.content,
        suggestions: uniqueStrings(reply.suggestions),
        sourceQuestion: content,
      },
    ]);

    setLoading(false);
    window.setTimeout(() => inputRef.current?.focus(), 40);
  }

  async function rateReply(message: AssistantMessage, rating: "up" | "down") {
    if (feedback[message.id]) return;
    setFeedback((prev) => ({ ...prev, [message.id]: "sending" }));
    try {
      await submitAssistantFeedback({
        category: rating === "up" ? "OTHER" : "COMPLAINT",
        subject: rating === "up" ? "Assistant reply rated helpful" : "Assistant reply rated unhelpful",
        message:
          `User rated an assistant reply ${rating === "up" ? "helpful 👍" : "unhelpful 👎"}.\n\n` +
          `Question: ${message.sourceQuestion ?? "(unknown)"}\n\nReply: ${message.content}`,
        sourceQuestion: message.sourceQuestion,
      });
      setFeedback((prev) => ({ ...prev, [message.id]: rating }));
    } catch {
      // Surface failures by re-enabling the controls rather than blocking the chat.
      setFeedback((prev) => {
        const next = { ...prev };
        delete next[message.id];
        return next;
      });
    }
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void sendMessage(input);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage(input);
    }
  }

  return (
    <div className="flex h-full flex-col">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b border-black/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-500 text-xs font-bold text-white">A</span>
          <div>
            <p className="text-sm font-semibold">Assistant</p>
            <p className="text-xs text-black/50">Powered by your live data</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            setMessages(initialMessages);
            setInput("");
          }}
          className="inline-flex items-center gap-1.5 rounded-xl border border-black/15 px-3 py-1.5 text-xs text-black/60 transition hover:bg-black/[0.04]"
        >
          <RotateCcw className="h-3 w-3" />
          New chat
        </button>
      </div>

      {/* Messages area — the ONLY scrollable part */}
      <div
        className="flex-1 overflow-y-auto px-4 py-4"
        role="log"
        aria-live="polite"
        aria-label="Chat"
      >
        <div className="mx-auto max-w-2xl space-y-4">
          {messages.map((message) => (
            <div key={message.id} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
              {message.role === "user" ? (
                <div className="max-w-[80%] rounded-[1.4rem] rounded-br-md bg-sky-500 px-4 py-3 text-sm text-white">
                  {message.content}
                </div>
              ) : (
                <div className="max-w-[86%]">
                  <div className="rounded-[1.4rem] rounded-bl-md bg-black/[0.04] px-4 py-3 text-[color:var(--text-primary)]">
                    <MessageContent content={message.content} />
                  </div>
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.suggestions.map((s) => (
                        <button
                          key={`${message.id}-${s}`}
                          type="button"
                          onClick={() => void sendMessage(s)}
                          disabled={loading}
                          className="rounded-full border border-black/15 bg-white px-3 py-1 text-xs text-black/70 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  )}
                  {message.sourceQuestion ? (
                    <div className="mt-2 flex items-center gap-1.5 pl-1">
                      {feedback[message.id] === "up" || feedback[message.id] === "down" ? (
                        <span className="text-xs text-[color:var(--text-secondary)]">
                          Thanks for the feedback{feedback[message.id] === "down" ? " — we’ll use it to improve" : ""}.
                        </span>
                      ) : (
                        <>
                          <button
                            type="button"
                            aria-label="This reply was helpful"
                            disabled={feedback[message.id] === "sending"}
                            onClick={() => void rateReply(message, "up")}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition hover:bg-black/[0.05] hover:text-emerald-600 disabled:opacity-50"
                          >
                            <ThumbsUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="This reply was not helpful"
                            disabled={feedback[message.id] === "sending"}
                            onClick={() => void rateReply(message, "down")}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[color:var(--text-secondary)] transition hover:bg-black/[0.05] hover:text-rose-600 disabled:opacity-50"
                          >
                            <ThumbsDown className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  ) : null}
                </div>
              )}
            </div>
          ))}

          {loading && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-[1.4rem] rounded-bl-md bg-black/[0.04] px-4 py-3">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-black/40 [animation-delay:240ms]" />
                </span>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Suggested prompts — shown above input when chat hasn't started */}
      {!chatStarted && (
        <div className="shrink-0 border-t border-black/[0.06] px-4 pb-2 pt-3">
          <div className="mx-auto max-w-2xl">
            <p className="mb-2 text-xs text-black/40">Try asking:</p>
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => void sendMessage(p.message)}
                  disabled={loading}
                  className="rounded-full border border-black/15 bg-white px-3 py-1.5 text-xs text-black/70 transition hover:border-sky-300 hover:bg-sky-50 hover:text-sky-700"
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input bar */}
      <div className="shrink-0 border-t border-black/10 px-4 py-3">
        <form onSubmit={handleSubmit} className="mx-auto flex max-w-2xl items-end gap-2">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={1}
            disabled={loading}
            aria-label="Message Assistant"
            placeholder="Ask me anything about your budget, goals, or how the app works…"
            className="min-h-11 flex-1 resize-none rounded-2xl border border-black/15 bg-white px-4 py-2.5 text-sm focus:border-sky-300 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-sky-500 text-white transition hover:bg-sky-600 disabled:opacity-40"
          >
            <ArrowUp className="h-5 w-5" />
          </button>
        </form>
        <p className="mt-1.5 text-center text-[11px] text-black/30">
          Enter to send · Shift+Enter for new line ·{" "}
          <a href="/contact" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-black/60">
            Contact support
          </a>
        </p>
      </div>
    </div>
  );
}
