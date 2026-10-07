"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import pkg from "../../../../package.json";
import { DIAGRAMS, type DiagramDef, type NodeDetail } from "../diagrams";
import styles from "./DiagramExplorer.module.css";

type Transform = { x: number; y: number; k: number };
const MIN_K = 0.25;
const MAX_K = 3;

const VERSIONS: Record<string, string> = {
  ...((pkg as { dependencies?: Record<string, string> }).dependencies ?? {}),
  ...((pkg as { devDependencies?: Record<string, string> }).devDependencies ?? {}),
};

let renderCounter = 0;
let mermaidReady: Promise<typeof import("mermaid").default> | null = null;

function loadMermaid() {
  if (!mermaidReady) {
    mermaidReady = import("mermaid").then(({ default: mermaid }) => {
      mermaid.initialize({
        startOnLoad: false,
        securityLevel: "strict",
        theme: "base",
        fontFamily: "Inter, 'Noto Sans Devanagari', system-ui, sans-serif",
        themeVariables: {
          primaryColor: "#ffffff",
          primaryBorderColor: "#0b1f4d",
          primaryTextColor: "#111111",
          lineColor: "#64748b",
          secondaryColor: "#fff7ee",
          tertiaryColor: "#f8fafc",
          clusterBkg: "#fbfaf7",
          clusterBorder: "#d6d3cd",
          fontSize: "14px",
          actorBkg: "#eef2ff",
          actorBorder: "#0b1f4d",
          signalColor: "#334155",
          noteBkgColor: "#fff7ee",
          noteBorderColor: "#c2570c",
        },
        flowchart: { curve: "basis", htmlLabels: true, padding: 10, nodeSpacing: 30, rankSpacing: 38, useMaxWidth: false },
        sequence: { useMaxWidth: false, mirrorActors: false, actorMargin: 60, messageMargin: 34 },
      });
      return mermaid;
    });
  }
  return mermaidReady;
}

/** Mermaid ids look like `mmd-architecture-2-flowchart-SCR-2`: a prefix, the node name, then an index. */
const NODE_ID = /flowchart-(.+)-\d+$/;

function nodeKey(el: Element | null): string | null {
  const node = el?.closest("g.node");
  const match = node?.id.match(NODE_ID);
  return match ? match[1] : null;
}

export function DiagramExplorer() {
  const [index, setIndex] = useState(0);
  const diagram: DiagramDef = DIAGRAMS[index];

  const [svg, setSvg] = useState("");
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [view, setView] = useState<Transform>({ x: 0, y: 0, k: 1 });
  const [showSource, setShowSource] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const rootRef = useRef<HTMLDivElement>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const natural = useRef({ w: 0, h: 0 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number; moved: boolean } | null>(null);
  const viewRef = useRef(view);
  viewRef.current = view;

  /* ---- render the active diagram ---- */
  useEffect(() => {
    let cancelled = false;
    setStatus("loading");
    setSelected(null);
    setShowSource(false);

    loadMermaid()
      .then((mermaid) => mermaid.render(`mmd-${diagram.id}-${++renderCounter}`, diagram.code))
      .then(({ svg: out }) => {
        if (cancelled) return;
        setSvg(out);
        setStatus("ready");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Could not render this diagram.");
        setStatus("error");
      });

    return () => {
      cancelled = true;
    };
  }, [diagram]);

  /* ---- fit the picture to the viewport ---- */
  const fit = useCallback(() => {
    const vp = viewportRef.current;
    const el = stageRef.current?.querySelector("svg");
    if (!vp || !el) return;
    const vb = el.getAttribute("viewBox")?.split(/[\s,]+/).map(Number);
    const w = vb && vb.length === 4 ? vb[2] : el.getBoundingClientRect().width;
    const h = vb && vb.length === 4 ? vb[3] : el.getBoundingClientRect().height;
    if (!w || !h) return;
    el.setAttribute("width", String(w));
    el.setAttribute("height", String(h));
    el.style.maxWidth = "none";
    natural.current = { w, h };
    const { width, height } = vp.getBoundingClientRect();
    const fitK = Math.min((width - 40) / w, (height - 40) / h, 1.35);
    // Never start below a readable size: a tall diagram opens at the top and is panned, and "Fit" shows it all.
    const k = Math.max(fitK, 0.55);
    const kk = Math.min(k, (width - 40) / w || k); // never wider than the canvas
    const tooTall = h * kk > height - 40;
    setView({
      k: kk,
      x: (width - w * kk) / 2,
      y: tooTall ? 20 : (height - h * kk) / 2,
    });
  }, []);

  useEffect(() => {
    if (status === "ready") fit();
  }, [status, svg, fit]);

  useEffect(() => {
    const onChange = () => {
      setIsFullscreen(document.fullscreenElement === rootRef.current);
      requestAnimationFrame(fit);
    };
    document.addEventListener("fullscreenchange", onChange);
    window.addEventListener("resize", fit);
    return () => {
      document.removeEventListener("fullscreenchange", onChange);
      window.removeEventListener("resize", fit);
    };
  }, [fit]);

  /* ---- zoom ---- */
  const zoomAt = useCallback((factor: number, cx?: number, cy?: number) => {
    const vp = viewportRef.current;
    if (!vp) return;
    const rect = vp.getBoundingClientRect();
    const px = cx ?? rect.width / 2;
    const py = cy ?? rect.height / 2;
    const v = viewRef.current;
    const k = Math.min(MAX_K, Math.max(MIN_K, v.k * factor));
    const ratio = k / v.k;
    setView({ k, x: px - (px - v.x) * ratio, y: py - (py - v.y) * ratio });
  }, []);

  // Wheel zoom only with Ctrl/Cmd, so the page itself still scrolls normally.
  useEffect(() => {
    const vp = viewportRef.current;
    if (!vp) return;
    const onWheel = (e: WheelEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      const rect = vp.getBoundingClientRect();
      zoomAt(e.deltaY < 0 ? 1.12 : 1 / 1.12, e.clientX - rect.left, e.clientY - rect.top);
    };
    vp.addEventListener("wheel", onWheel, { passive: false });
    return () => vp.removeEventListener("wheel", onWheel);
  }, [zoomAt]);

  /* ---- drag to pan, click to select ---- */
  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as Element).closest("button")) return;
    drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = e.clientX - d.x;
    const dy = e.clientY - d.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) d.moved = true;
    if (d.moved) setView((v) => ({ ...v, x: d.vx + dx, y: d.vy + dy }));
  };
  const onPointerUp = (e: React.PointerEvent) => {
    const moved = drag.current?.moved;
    drag.current = null;
    e.currentTarget.releasePointerCapture(e.pointerId);
    if (moved || diagram.kind !== "flowchart") return;
    const key = nodeKey(document.elementFromPoint(e.clientX, e.clientY));
    setSelected((cur) => (key && diagram.details?.[key] ? (cur === key ? null : key) : null));
  };

  /* ---- highlight the selected box ---- */
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    stage.querySelectorAll("g.node.is-selected").forEach((n) => n.classList.remove("is-selected"));
    if (selected) {
      const target = [...stage.querySelectorAll("g.node")].find((n) => n.id.match(NODE_ID)?.[1] === selected);
      target?.classList.add("is-selected");
    }
  }, [selected, svg]);

  const copySource = async () => {
    try {
      await navigator.clipboard.writeText(diagram.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setShowSource(true);
    }
  };

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.();
  };

  const detail: NodeDetail | null = selected ? diagram.details?.[selected] ?? null : null;
  const clickable = diagram.kind === "flowchart";

  return (
    <div ref={rootRef} className={`${styles.root} ${isFullscreen ? styles.fullscreen : ""}`}>
      <div className={styles.tabs} role="tablist" aria-label="Diagrams">
        {DIAGRAMS.map((d, i) => (
          <button
            key={d.id}
            role="tab"
            aria-selected={i === index}
            className={i === index ? styles.tabOn : styles.tab}
            onClick={() => setIndex(i)}
          >
            {d.label}
          </button>
        ))}
      </div>

      <div className={styles.head}>
        <div>
          <h3 className={styles.title}>{diagram.title}</h3>
          <p className={styles.summary}>{diagram.summary}</p>
        </div>
        <div className={styles.tools}>
          <button className={styles.tool} onClick={() => zoomAt(1 / 1.25)} aria-label="Zoom out">
            −
          </button>
          <span className={styles.zoom}>{Math.round(view.k * 100)}%</span>
          <button className={styles.tool} onClick={() => zoomAt(1.25)} aria-label="Zoom in">
            +
          </button>
          <button className={styles.toolText} onClick={fit}>
            Fit
          </button>
          <button className={styles.toolText} onClick={() => setShowSource((s) => !s)}>
            {showSource ? "Diagram" : "Source"}
          </button>
          <button className={styles.toolText} onClick={copySource}>
            {copied ? "Copied" : "Copy"}
          </button>
          <button className={styles.toolText} onClick={toggleFullscreen}>
            {isFullscreen ? "Exit" : "Fullscreen"}
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div
          ref={viewportRef}
          className={styles.viewport}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={() => (drag.current = null)}
        >
          {status === "loading" && <div className={styles.state}>Drawing diagram…</div>}
          {status === "error" && (
            <div className={styles.state}>
              Could not draw this diagram. <code>{error}</code>
            </div>
          )}
          {showSource ? (
            <pre className={styles.source}>{diagram.code}</pre>
          ) : (
            <div
              ref={stageRef}
              className={`${styles.stage} ${clickable ? styles.stageClickable : ""}`}
              style={{ transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})` }}
              dangerouslySetInnerHTML={{ __html: svg }}
            />
          )}
          <span className={styles.hint}>
            Drag to pan · Ctrl + scroll or +/− to zoom{clickable ? " · click a box" : ""}
          </span>
        </div>

        <aside
          className={`${styles.panel} ${detail ? styles.panelOpen : diagram.kind === "sequence" ? styles.panelSteps : styles.panelIdle}`}
          aria-live="polite"
        >
          {detail ? (
            <>
              <span className={styles.panelKicker}>Selected</span>
              <h4 className={styles.panelTitle}>{detail.title}</h4>
              <p className={styles.panelText}>{detail.text}</p>
              {detail.facts && (
                <div className={styles.chips}>
                  {detail.facts.map((f) => (
                    <span key={f} className={styles.chip}>
                      {f}
                    </span>
                  ))}
                </div>
              )}
              {detail.pkg && (
                <div className={styles.block}>
                  <span className={styles.blockLabel}>Packages</span>
                  {detail.pkg.map((p) => (
                    <div key={p} className={styles.pkg}>
                      <span>{p}</span>
                      <code>{VERSIONS[p] ?? "—"}</code>
                    </div>
                  ))}
                </div>
              )}
              {detail.files && (
                <div className={styles.block}>
                  <span className={styles.blockLabel}>Where it lives</span>
                  {detail.files.map((f) => (
                    <code key={f} className={styles.file}>
                      {f}
                    </code>
                  ))}
                </div>
              )}
              <button className={styles.clear} onClick={() => setSelected(null)}>
                Clear selection
              </button>
            </>
          ) : diagram.kind === "sequence" ? (
            <>
              <span className={styles.panelKicker}>Reading this diagram</span>
              <ol className={styles.steps}>
                {diagram.steps?.map((s) => (
                  <li key={s}>{s}</li>
                ))}
              </ol>
            </>
          ) : (
            <>
              <span className={styles.panelKicker}>Interactive</span>
              <h4 className={styles.panelTitle}>Click any box</h4>
              <p className={styles.panelText}>
                Each box explains what it does, which files implement it and which package versions it uses.
              </p>
              <div className={styles.legend}>
                {Object.entries(diagram.details ?? {})
                  .slice(0, 8)
                  .map(([key, d]) => (
                    <button key={key} className={styles.legendItem} onClick={() => setSelected(key)}>
                      {d.title}
                    </button>
                  ))}
              </div>
            </>
          )}
        </aside>
      </div>
    </div>
  );
}
