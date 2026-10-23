import React, { useEffect, useRef } from "react";
import type { Loop } from "./canvas/loop";

/** Mounts a decorative canvas and runs a drawing loop on it for the component's lifetime. */
export default function CanvasLayer({
  start,
  className = "lq-canvas",
  onReady,
}: {
  start: (canvas: HTMLCanvasElement) => Loop;
  className?: string;
  onReady?: (loop: Loop) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!ref.current) return;
    const loop = start(ref.current);
    onReady?.(loop);
    return () => loop.stop();
    // start is created once per mount by the caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return <canvas ref={ref} className={className} aria-hidden="true" />;
}
