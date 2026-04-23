"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DataMode } from "@/lib/config";

type Tone = "default" | "accent" | "dim" | "ok" | "error";

type Line = {
  text: string;
  tone?: Tone;
  pauseAfterMs?: number;
  instant?: boolean;
};

const CHAR_INTERVAL_MS = 16;
const CHARS_PER_TICK = 2;
const DEFAULT_LINE_PAUSE_MS = 70;
const BLANK_LINE_PAUSE_MS = 140;
const MAX_COMMAND_LEN = 32;
const MAX_HANDLE_LEN = 15;
const HANDLE_RE = /^[A-Za-z0-9_]{1,15}$/;

function toneClass(tone: Tone | undefined): string | undefined {
  switch (tone) {
    case "accent":
      return "dos-brand";
    case "dim":
      return "dos-dim";
    case "ok":
      return "dos-ok";
    case "error":
      return "dos-error";
    default:
      return undefined;
  }
}

export function LandingTerminal({
  mode,
  severed,
  oauthError
}: {
  mode: DataMode;
  severed: boolean;
  oauthError?: string;
}) {
  const lines = useMemo<Line[]>(() => {
    const boot: Line[] = [
      { text: "C:\\> TWEET-DELETE.EXE /boot", tone: "accent" },
      { text: "LOADING PUBLIC POSTS BROWSER v0.1 ..." },
      { text: "CHECKING COLD STORAGE ........... OK" },
      { text: "CHECKING AUTH MODULE ............ OK" },
      { text: "MOUNTING ARCHIVE ................ OK" },
      { text: "READY.", tone: "ok", pauseAfterMs: 220 },
      { text: "" }
    ];

    const status: Line[] = [];
    if (severed) {
      status.push({ text: "> ACCESS SEVERED. RECONNECT TO BROWSE.", tone: "ok" });
      status.push({ text: "" });
    }
    if (oauthError) {
      status.push({ text: `> OAUTH ERROR: ${oauthError}`, tone: "error" });
      status.push({ text: "" });
    }

    const prose: Line[] = [
      { text: "> Browse your old public X posts by year." },
      { text: "> Filter by keyword or date range." },
      { text: "> Read what you wrote a decade ago before deciding what to do about it." },
      { text: "" }
    ];

    const modeLine: Line[] = [];
    if (mode === "server") {
      modeLine.push({
        text: "> Requires read access to your X account. Tokens are encrypted at rest.",
        tone: "dim"
      });
      modeLine.push({
        text: "> You can sever the link at any time.",
        tone: "dim"
      });
    } else if (mode === "user") {
      modeLine.push({
        text: "> Step 1: connect X for identity only. No tweets read via the API.",
        tone: "dim"
      });
      modeLine.push({
        text: "> Step 2: upload your X data archive or paste your own bearer.",
        tone: "dim"
      });
    } else {
      modeLine.push({
        text: "> Requires read access to your X account.",
        tone: "dim"
      });
      modeLine.push({
        text: "> If server API credits are out, upload an archive or paste your own bearer.",
        tone: "dim"
      });
    }
    modeLine.push({ text: "", pauseAfterMs: 200 });

    const prompt: Line[] = [
      { text: "CONNECT STEP 1 OF 1 ... type `connect` to begin.", tone: "accent", pauseAfterMs: 180 },
      { text: "" }
    ];

    return [...boot, ...status, ...prose, ...modeLine, ...prompt];
  }, [mode, severed, oauthError]);

  const [activeIndex, setActiveIndex] = useState(0);
  const [activeText, setActiveText] = useState("");
  const [done, setDone] = useState(false);
  const [userInput, setUserInput] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [handleModalOpen, setHandleModalOpen] = useState(false);
  const skippedRef = useRef(false);

  const finishAll = useCallback(() => {
    skippedRef.current = true;
    setActiveIndex(lines.length);
    setActiveText("");
    setDone(true);
  }, [lines.length]);

  useEffect(() => {
    skippedRef.current = false;
    setActiveIndex(0);
    setActiveText("");
    setDone(false);
    setUserInput("");
    setHint(null);
  }, [lines]);

  useEffect(() => {
    if (skippedRef.current) return;
    if (activeIndex >= lines.length) {
      setDone(true);
      return;
    }
    const line = lines[activeIndex];
    if (line.instant || line.text.length === 0) {
      const pause =
        line.pauseAfterMs ?? (line.text.length === 0 ? BLANK_LINE_PAUSE_MS : DEFAULT_LINE_PAUSE_MS);
      const timeout = window.setTimeout(() => {
        setActiveIndex((i) => i + 1);
        setActiveText("");
      }, pause);
      return () => window.clearTimeout(timeout);
    }
    if (activeText.length >= line.text.length) {
      const pause = line.pauseAfterMs ?? DEFAULT_LINE_PAUSE_MS;
      const timeout = window.setTimeout(() => {
        setActiveIndex((i) => i + 1);
        setActiveText("");
      }, pause);
      return () => window.clearTimeout(timeout);
    }
    const interval = window.setInterval(() => {
      setActiveText((prev) => {
        const next = line.text.slice(
          0,
          Math.min(line.text.length, prev.length + CHARS_PER_TICK)
        );
        return next;
      });
    }, CHAR_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, [activeIndex, activeText, lines]);

  useEffect(() => {
    if (done) return;
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape" || event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        finishAll();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [done, finishAll]);

  useEffect(() => {
    if (!done || handleModalOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;

      const key = event.key;
      if (key === "Enter") {
        event.preventDefault();
        const cmd = userInput.trim().toLowerCase();
        if (cmd === "connect" || cmd === "c") {
          setHandleModalOpen(true);
          setHint(null);
        } else if (cmd.length === 0) {
          setHint("TYPE `connect` TO CONTINUE.");
        } else {
          setHint(`BAD COMMAND: ${cmd}. TYPE \`connect\` TO CONTINUE.`);
        }
        return;
      }
      if (key === "Backspace") {
        event.preventDefault();
        setUserInput((v) => v.slice(0, -1));
        setHint(null);
        return;
      }
      if (key === "Escape") {
        event.preventDefault();
        setUserInput("");
        setHint(null);
        return;
      }
      if (key.length === 1) {
        event.preventDefault();
        setUserInput((v) => (v.length < MAX_COMMAND_LEN ? v + key : v));
        setHint(null);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [done, handleModalOpen, userInput]);

  const completed = lines.slice(0, activeIndex);
  const activeLine = activeIndex < lines.length ? lines[activeIndex] : null;

  const handleSubmitHandle = useCallback((rawHandle: string) => {
    const cleaned = rawHandle.replace(/^@/, "").trim();
    if (!HANDLE_RE.test(cleaned)) return;
    window.location.href = "/api/x/oauth/start";
  }, []);

  return (
    <main className="dos-main">
      <div className="dos-panel dos-landing">
        <header className="dos-panel-head">
          <span className="dos-brand">TWEET-DELETE</span>
          <span className="dos-dim">v0.1 / PUBLIC POSTS BROWSER</span>
        </header>

        <div
          className="dos-panel-body dos-terminal"
          role="log"
          aria-live="polite"
          onClick={() => {
            if (!done) finishAll();
          }}
        >
          {completed.map((line, index) => (
            <TerminalLine key={`done-${index}`} line={line} />
          ))}
          {!done && activeLine ? (
            <TerminalLine line={activeLine} typedText={activeText} showCaret />
          ) : null}
          {done && hint ? (
            <TerminalLine line={{ text: hint, tone: "error" }} />
          ) : null}
          {done ? (
            <TerminalLine
              line={{ text: "", tone: "accent" }}
              typedText={`C:\\> ${userInput}`}
              showCaret
            />
          ) : null}
        </div>

        {!done ? (
          <div className="dos-panel-body">
            <p className="dos-dim" style={{ margin: 0, letterSpacing: "0.04em" }}>
              [ CLICK / ANY KEY ] SKIP BOOT
            </p>
          </div>
        ) : (
          <div className="dos-panel-body">
            <p className="dos-dim" style={{ margin: 0, letterSpacing: "0.04em" }}>
              [ TYPE `connect` ] [ ENTER ] BEGIN &middot; [ BACKSPACE ] EDIT &middot; [ ESC ] CLEAR
            </p>
          </div>
        )}
      </div>
      {handleModalOpen ? (
        <HandleModal
          onCancel={() => setHandleModalOpen(false)}
          onSubmit={handleSubmitHandle}
        />
      ) : null}
    </main>
  );
}

function TerminalLine({
  line,
  typedText,
  showCaret
}: {
  line: Line;
  typedText?: string;
  showCaret?: boolean;
}) {
  const text = typedText ?? line.text;
  const className = toneClass(line.tone);
  const content = text.length === 0 ? "\u00a0" : text;
  return (
    <div className={`dos-terminal-line${className ? ` ${className}` : ""}`}>
      <span>{content}</span>
      {showCaret ? <span className="dos-caret" aria-hidden="true" /> : null}
    </div>
  );
}

function HandleModal({
  onCancel,
  onSubmit
}: {
  onCancel: () => void;
  onSubmit: (handle: string) => void;
}) {
  const [handle, setHandle] = useState("");
  const cleaned = handle.replace(/^@/, "").trim();
  const valid = HANDLE_RE.test(cleaned);
  return (
    <div
      className="dos-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dos-handle-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div className="dos-modal dos-panel">
        <header className="dos-panel-head">
          <span className="dos-brand" id="dos-handle-title">
            CONNECT
          </span>
          <span className="dos-dim">STEP 1 / 1</span>
        </header>
        <div className="dos-panel-body dos-stack">
          <p>
            Enter the @ handle of the X account you&apos;re about to walk through.
          </p>
          <label className="dos-field">
            <span>HANDLE</span>
            <div className="dos-handle-row">
              <span className="dos-handle-at">@</span>
              <input
                type="text"
                value={handle}
                onChange={(event) => setHandle(event.target.value.replace(/^@/, ""))}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && valid) {
                    event.preventDefault();
                    onSubmit(cleaned);
                  } else if (event.key === "Escape") {
                    event.preventDefault();
                    onCancel();
                  }
                }}
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="yourhandle"
                maxLength={MAX_HANDLE_LEN}
                aria-invalid={handle.length > 0 && !valid}
              />
            </div>
          </label>
          <p className="dos-dim" style={{ margin: 0 }}>
            Letters, numbers, underscores. 1&ndash;15 characters. No @.
            Authorization on X is what actually connects you.
          </p>
          <div className="dos-row-between">
            <button type="button" className="dos-button" onClick={onCancel}>
              [ Cancel ]
            </button>
            <button
              type="button"
              className="dos-button dos-button-accent"
              onClick={() => onSubmit(cleaned)}
              disabled={!valid}
            >
              [ Continue &gt; ]
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
