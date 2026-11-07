"use client";

import React, { useEffect, useRef } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

interface TerminalStreamProps {
  logs?: string[];
}

export const TerminalStream: React.FC<TerminalStreamProps> = ({ logs = [] }) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermInstance = useRef<Terminal | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

    const term = new Terminal({
      theme: {
        background: "#0d1117",
        foreground: "#58a6ff",
        cursor: "#58a6ff",
      },
      fontFamily: 'Consolas, Monaco, "Courier New", monospace',
      fontSize: 13,
      rows: 18,
      convertEol: true,
    });

    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(terminalRef.current);
    fitAddon.fit();

    term.writeln("\x1b[1;32m[Hermes Sandbox]\x1b[0m Ephemeral MicroVM Sandbox Ready (E2B / Firecracker)");
    term.writeln("\x1b[1;34m[WebSocket]\x1b[0m Connected to shell stream stdout/stderr");
    term.writeln("------------------------------------------------------------------");

    xtermInstance.current = term;

    return () => {
      term.dispose();
    };
  }, []);

  useEffect(() => {
    if (!xtermInstance.current || logs.length === 0) return;
    const latest = logs[logs.length - 1];
    if (latest) {
      xtermInstance.current.writeln(latest);
    }
  }, [logs]);

  return (
    <div className="rounded-lg border border-slate-800 bg-[#0d1117] p-3 shadow-xl">
      <div className="mb-2 flex items-center justify-between border-b border-slate-800 pb-2">
        <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
          Live Sandbox MicroVM Terminal (Xterm.js)
        </span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-400">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Active MicroVM (<500ms boot)
        </span>
      </div>
      <div ref={terminalRef} className="h-64 w-full" />
    </div>
  );
};

