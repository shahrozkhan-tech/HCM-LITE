"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Bot, ShieldCheck, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAiChatMutation } from "@/store/api";
import { cn } from "@/lib/utils";

const SUGGESTIONS = {
  admin: [
    "What is the current headcount?",
    "Summarize this month's attendance",
    "Show payroll cost trend",
  ],
  hr: [
    "How many active employees are in each department?",
    "Who came late most often this month?",
    "Who is on leave today?",
  ],
  employee: [
    "How many sick leaves do I have left?",
    "What are the office timings and grace period?",
    "How is my half-day calculated?",
  ],
};

/** Global AI chat drawer (M8). Talks to /api/ai/chat — never to the AI provider. */
export function AiAssistant({ role = "employee" }) {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]);
  const [chat, { isLoading }] = useAiChatMutation();
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const send = async (text) => {
    const question = (text ?? input).trim();
    if (!question || isLoading) return;
    setInput("");
    const next = [...messages, { role: "user", content: question }];
    setMessages(next);
    try {
      const res = await chat({
        messages: next.filter((m) => m.role === "user" || m.role === "assistant"),
      }).unwrap();
      setMessages((m) => [
        ...m,
        { role: "assistant", content: res.answer ?? "…", tools: res.toolsCalled ?? [], ai: res.aiGenerated },
      ]);
    } catch {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Sorry, the assistant is unavailable right now. Please try again.", tools: [] },
      ]);
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          size="sm"
          className="gap-1.5 bg-brand-gradient btn-shine shadow-md transition-transform hover:scale-105"
        >
          <Sparkles className="h-4 w-4" /> Ask AI
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md p-0 flex flex-col border-l-0">
        <SheetHeader className="bg-brand-gradient relative border-b p-4 pb-4 text-white">
          <div className="pointer-events-none absolute -right-8 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
          <SheetTitle className="flex items-center gap-2.5 text-base text-white">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/20 backdrop-blur">
              <Bot className="h-5 w-5" />
            </span>
            HCM Assistant
          </SheetTitle>
          <SheetDescription className="flex items-center gap-1.5 text-xs text-white/85">
            <ShieldCheck className="h-3.5 w-3.5" /> Answers from live company data, scoped to your role
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 space-y-3 overflow-y-auto scroll-thin p-4">
          {messages.length === 0 && (
            <div className="animate-fade-up space-y-4">
              <div className="rounded-2xl border bg-muted/50 p-4 text-center">
                <Wand2 className="mx-auto mb-2 h-6 w-6 text-primary" />
                <p className="text-sm font-semibold">Ask anything about your HR data</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  headcount · attendance · leave balances · payroll · policy (Roman Urdu bhi chalega)
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(SUGGESTIONS[role] ?? SUGGESTIONS.employee).map((s, i) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    style={{ animationDelay: `${0.06 * i}s` }}
                    className="animate-fade-up rounded-full border bg-muted/50 px-3 py-1.5 text-xs transition-all hover:scale-105 hover:border-primary/40 hover:bg-accent"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m, i) => (
            <div key={i} className={cn("flex animate-fade-up", m.role === "user" ? "justify-end" : "justify-start")}>
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-sm",
                  m.role === "user"
                    ? "bg-brand-gradient rounded-br-md text-white"
                    : "rounded-bl-md border bg-card"
                )}
              >
                {m.content}
                {m.role === "assistant" && (
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    <Badge variant="outline" className="text-[9px] px-1.5 py-0">AI-generated</Badge>
                    {(m.tools ?? []).map((t, j) => (
                      <Badge key={j} variant="muted" className="font-mono text-[9px] px-1.5 py-0">{t}</Badge>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start animate-fade-in">
              <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-3 shadow-sm">
                <div className="typing-dots">
                  <span /><span /><span />
                </div>
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        <div className="border-t p-3 flex gap-2 items-end bg-card/80 backdrop-blur">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="Ask anything… (Roman Urdu bhi chalega)"
            className="min-h-[44px] max-h-32 resize-none rounded-xl"
            rows={1}
          />
          <Button
            size="icon"
            onClick={() => send()}
            disabled={isLoading || !input.trim()}
            className="h-11 w-11 shrink-0 rounded-xl transition-transform hover:scale-105"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
