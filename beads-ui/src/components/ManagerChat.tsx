import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../api";
import type { ChatMessage, UiEvent, Gate } from "../types";

export function ManagerChat() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamBuffer, setStreamBuffer] = useState("");
  const [gates, setGates] = useState<Gate[]>([]);
  const [workerOutputs, setWorkerOutputs] = useState<Record<string, string>>({});
  const scrollRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      }
    });
  }, []);

  useEffect(() => {
    api.manager.messages().then(setMessages).catch(() => {});
    api.gates.list().then(setGates).catch(() => {});
  }, []);

  useEffect(() => {
    const unsub = api.subscribeEvents((event: UiEvent) => {
      switch (event.type) {
        case "user_message":
          setMessages((prev) => [...prev, event.message]);
          scrollToBottom();
          break;
        case "manager_thinking":
          setStreaming(event.active);
          if (event.active) setStreamBuffer("");
          break;
        case "manager_stream":
          setStreamBuffer((prev) => prev + event.delta);
          scrollToBottom();
          break;
        case "manager_message":
          setMessages((prev) => [...prev, event.message]);
          setStreamBuffer("");
          scrollToBottom();
          break;
        case "gate_opened":
          setGates((prev) => [...prev, event.gate]);
          break;
        case "gate_resolved":
          setGates((prev) => prev.filter((g) => g.id !== event.gateId));
          break;
        case "worker_output":
          setWorkerOutputs((prev) => ({
            ...prev,
            [event.workerId]: (prev[event.workerId] ?? "") + event.delta,
          }));
          break;
        case "worker_started":
          setWorkerOutputs((prev) => ({ ...prev, [event.worker.id]: "" }));
          break;
        case "error":
          setMessages((prev) => [...prev, {
            id: Date.now().toString(),
            role: "system",
            content: `Error: ${event.message}`,
            createdAt: new Date().toISOString(),
          }]);
          break;
      }
    });
    return unsub;
  }, [scrollToBottom]);

  async function handleSend() {
    if (!input.trim() || streaming) return;
    const content = input.trim();
    setInput("");
    await api.manager.send(content);
  }

  async function handleResolveGate(gateId: string) {
    await api.gates.resolve(gateId);
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      <div className="border-b border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <h1 className="text-sm font-semibold text-[var(--text)]">Manager</h1>
        <p className="text-xs text-[var(--text-muted)] mt-0.5">
          Talk to the manager agent. It decomposes work, dispatches workers, and escalates to you when needed.
        </p>
      </div>

      {gates.length > 0 && (
        <div className="border-b border-[var(--border)] bg-[var(--yellow)]/10 px-5 py-3">
          <div className="text-xs font-semibold text-[var(--yellow)] mb-2">
            Human gates ({gates.length})
          </div>
          <div className="space-y-2">
            {gates.map((gate) => (
              <div key={gate.id} className="flex items-start gap-3 rounded-md bg-[var(--surface)] px-3 py-2">
                <div className="flex-1 text-sm text-[var(--text)]">
                  <div className="font-medium">{gate.reason ?? "Gate requires attention"}</div>
                  <div className="text-xs text-[var(--text-muted)] mt-0.5">
                    Issue: {gate.issueId} · Type: {gate.type}
                  </div>
                </div>
                <button
                  onClick={() => handleResolveGate(gate.id)}
                  className="rounded-md bg-[var(--green)] px-3 py-1 text-xs font-medium text-[var(--bg)] hover:opacity-90"
                >
                  Resolve
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div ref={scrollRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
        {messages.length === 0 && !streaming && (
          <div className="flex h-full items-center justify-center text-[var(--text-muted)] text-sm">
            Send a message to start working with the manager.
          </div>
        )}
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}
        {streaming && streamBuffer && (
          <MessageBubble
            message={{
              id: "streaming",
              role: "manager",
              content: streamBuffer,
              createdAt: new Date().toISOString(),
            }}
            streaming
          />
        )}
        {Object.entries(workerOutputs).map(([workerId, output]) => (
          output && (
            <div key={workerId} className="rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2">
              <div className="text-xs text-[var(--text-muted)] mb-1">Worker {workerId.slice(0, 8)}</div>
              <pre className="text-xs text-[var(--text)] whitespace-pre-wrap font-mono max-h-40 overflow-y-auto">
                {output.slice(-2000)}
              </pre>
            </div>
          )
        ))}
      </div>

      <div className="border-t border-[var(--border)] bg-[var(--surface)] px-5 py-3">
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
            disabled={streaming}
            placeholder={streaming ? "Manager is thinking…" : "Send a message to the manager…"}
            className="flex-1 rounded-md border border-[var(--border)] bg-[var(--surface2)] px-3 py-2 text-sm text-[var(--text)] placeholder-[var(--text-muted)] outline-none focus:border-[var(--accent)] disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={streaming || !input.trim()}
            className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-medium text-[var(--bg)] disabled:opacity-50 hover:opacity-90"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message, streaming }: { message: ChatMessage; streaming?: boolean }) {
  const isUser = message.role === "user";
  const isSystem = message.role === "system";

  if (isSystem) {
    return (
      <div className="text-center text-xs text-[var(--red)] py-1">
        {message.content}
      </div>
    );
  }

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-lg px-4 py-2.5 text-sm whitespace-pre-wrap ${
          isUser
            ? "bg-[var(--accent)] text-[var(--bg)]"
            : "bg-[var(--surface2)] text-[var(--text)]"
        } ${streaming ? "opacity-70" : ""}`}
      >
        {!isUser && (
          <div className="text-xs font-semibold text-[var(--text-muted)] mb-1">
            Manager {streaming && "···"}
          </div>
        )}
        {message.content || (streaming ? "···" : "")}
      </div>
    </div>
  );
}
