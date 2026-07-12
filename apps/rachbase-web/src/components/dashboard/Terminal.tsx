"use client";

import { useEffect, useRef, useCallback } from "react";
import { X, Terminal as TerminalIcon } from "lucide-react";
import type { Terminal as XTerminal } from "xterm";
import type { FitAddon } from "xterm-addon-fit";

interface TerminalProps {
  vmId: string;
  vmName: string;
  token: string;
  onClose: () => void;
}

const WS_URL = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000")
  .replace(/^http/, "ws");

// Critical xterm CSS injected at runtime so it works in Next.js App Router
const XTERM_CSS = `
.xterm { position: relative; user-select: none; -ms-user-select: none; -webkit-user-select: none; }
.xterm.focus, .xterm:focus { outline: none; }
.xterm .xterm-helpers { position: absolute; top: 0; z-index: 5; }
.xterm .xterm-helper-textarea { padding: 0; border: 0; margin: 0; position: absolute; opacity: 0; left: -9999em; top: 0; width: 0; height: 0; z-index: -5; white-space: nowrap; overflow: hidden; resize: none; }
.xterm .composition-view { background: #000; color: #FFF; display: none; position: absolute; white-space: nowrap; z-index: 1; }
.xterm .composition-view.active { display: block; }
.xterm .xterm-viewport { background-color: #000; overflow-y: scroll; cursor: default; position: absolute; right: 0; left: 0; top: 0; bottom: 0; }
.xterm .xterm-viewport::-webkit-scrollbar { width: 6px; }
.xterm .xterm-viewport::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.2); border-radius: 3px; }
.xterm .xterm-screen { position: relative; }
.xterm .xterm-screen canvas { position: absolute; left: 0; top: 0; }
.xterm .xterm-scroll-area { visibility: hidden; }
.xterm-char-measure-element { display: inline-block; visibility: hidden; position: absolute; top: 0; left: -9999em; line-height: normal; }
.terminal-hscroll::-webkit-scrollbar { height: 4px; }
.terminal-hscroll::-webkit-scrollbar-track { background: #0d0d0d; }
.terminal-hscroll::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 2px; }
.xterm.enable-mouse-events { cursor: default; }
.xterm.xterm-cursor-pointer, .xterm .xterm-cursor-pointer { cursor: pointer; }
.xterm.column-select.focus { cursor: crosshair; }
.xterm .xterm-rows { color: #fff; font-kerning: none; white-space: nowrap; overflow: hidden; }
.xterm .xterm-rows > div { line-height: normal; }
.xterm .xterm-decoration-container .xterm-decoration { z-index: 6; position: absolute; }
.xterm .xterm-decoration-overview-ruler { z-index: 7; position: absolute; top: 0; right: 0; pointer-events: none; }
`;

function injectXtermCss() {
  if (document.getElementById("xterm-css-inject")) return;
  const style = document.createElement("style");
  style.id = "xterm-css-inject";
  style.textContent = XTERM_CSS;
  document.head.appendChild(style);
}

export function Terminal({ vmId, vmName, token, onClose }: TerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const termRef      = useRef<XTerminal | null>(null);
  const wsRef        = useRef<WebSocket | null>(null);
  const fitRef       = useRef<FitAddon | null>(null);

  const sendResize = useCallback((cols: number, rows: number) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "resize", cols, rows }));
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    injectXtermCss();

    // Stop vertical scroll from bubbling; allow horizontal scroll
    const container = containerRef.current;
    const stopWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) >= Math.abs(e.deltaX)) e.stopPropagation();
    };
    container.addEventListener("wheel", stopWheel, { passive: true });

    let disposed = false;

    import("xterm").then(({ Terminal: XTerm }) =>
    import("xterm-addon-fit").then(({ FitAddon }) => {
      if (disposed || !containerRef.current) return;

      const term = new XTerm({
        cursorBlink:   true,
        fontSize:      13,
        fontFamily:    "Menlo, Monaco, Consolas, 'Courier New', monospace",
        scrollback:    5000,
        convertEol:    true,
        theme: {
          background:    "#0d0d0d",
          foreground:    "#f0f0f0",
          cursor:        "#a78bfa",
          selectionBackground: "rgba(167,139,250,0.3)",
        },
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(containerRef.current!);

      // Must fit after the element is painted
      requestAnimationFrame(() => {
        try { fitAddon.fit(); } catch {}
        term.focus();
      });

      termRef.current = term;
      fitRef.current  = fitAddon;

      term.writeln("\x1b[2mConnecting...\x1b[0m");

      const ws = new WebSocket(`${WS_URL}/ws/terminal`);
      wsRef.current = ws;

      ws.onopen = () => {
        try { fitAddon.fit(); } catch {}
        ws.send(JSON.stringify({
          type: "connect", token, vm_id: vmId,
          cols: term.cols, rows: term.rows,
        }));
      };

      ws.onmessage = (e) => { term.write(e.data); };
      ws.onerror   = () => { term.writeln("\r\n\x1b[31m[Connection error]\x1b[0m"); };
      ws.onclose   = () => { term.writeln("\r\n\x1b[33m[Disconnected]\x1b[0m"); };

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ type: "input", data }));
      });

      const ro = new ResizeObserver(() => {
        requestAnimationFrame(() => {
          try {
            fitAddon.fit();
            sendResize(term.cols, term.rows);
          } catch {}
        });
      });
      ro.observe(containerRef.current!);

      return () => { ro.disconnect(); ws.close(); term.dispose(); };
    }));

    return () => {
      disposed = true;
      container.removeEventListener("wheel", stopWheel);
      wsRef.current?.close();
      termRef.current?.dispose();
    };
  }, [vmId, token, sendResize]);

  return (
    <div
      className="flex flex-col"
      style={{ height: "380px", borderRadius: "12px", overflow: "hidden", boxShadow: "0 -4px 24px rgba(0,0,0,0.4)" }}
    >
      {/* Titlebar */}
      <div
        className="flex items-center gap-3 px-4 shrink-0"
        style={{ background: "#1c1c1c", borderTop: "1px solid rgba(255,255,255,0.1)", height: "36px" }}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full cursor-pointer" style={{ background: "#ff5f57" }} onClick={onClose} />
          <div className="w-3 h-3 rounded-full" style={{ background: "#febc2e" }} />
          <div className="w-3 h-3 rounded-full" style={{ background: "#28c840" }} />
        </div>
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <TerminalIcon size={12} style={{ color: "rgba(255,255,255,0.3)" }} />
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "monospace" }}>{vmName}</span>
        </div>
        <button onClick={onClose} style={{ color: "rgba(255,255,255,0.3)", padding: "4px", borderRadius: "4px" }}>
          <X size={13} />
        </button>
      </div>

      {/* Horizontal scroll wrapper */}
      <div className="terminal-hscroll" style={{ flex: 1, minHeight: 0, background: "#0d0d0d", overflowX: "auto", overflowY: "hidden" }}>
        {/* xterm container — fixed min width so content doesn't reflow when chat opens */}
        <div
          ref={containerRef}
          style={{ height: "100%", minWidth: "600px", padding: "4px" }}
        />
      </div>
    </div>
  );
}
