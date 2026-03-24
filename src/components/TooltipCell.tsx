import { useState, useCallback, useRef, useEffect } from "react";
import { createPortal } from "react-dom";

export function TooltipCell({ value, tooltip }: { value: string; tooltip?: string }) {
  const [show, setShow] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const spanRef = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);

  const handleEnter = useCallback(() => {
    if (!tooltip || !spanRef.current) return;
    const rect = spanRef.current.getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top });
    setShow(true);
  }, [tooltip]);

  const handleLeave = useCallback(() => setShow(false), []);

  // Adjust position if tooltip overflows viewport
  useEffect(() => {
    if (!show || !tooltipRef.current) return;
    const el = tooltipRef.current;
    const rect = el.getBoundingClientRect();
    let { x, y } = pos;

    // Prevent overflow right
    if (rect.right > window.innerWidth - 8) {
      x -= rect.right - window.innerWidth + 8;
    }
    // Prevent overflow left
    if (rect.left < 8) {
      x += 8 - rect.left;
    }
    // If overflows top, show below instead
    if (rect.top < 8) {
      const spanRect = spanRef.current?.getBoundingClientRect();
      if (spanRect) y = spanRect.bottom + 6 + rect.height;
    }

    if (x !== pos.x || y !== pos.y) setPos({ x, y });
  }, [show, pos]);

  if (!tooltip) return <>{value}</>;

  return (
    <>
      <span
        ref={spanRef}
        className="cell-has-tooltip"
        onMouseEnter={handleEnter}
        onMouseLeave={handleLeave}
      >
        {value}
      </span>
      {show && createPortal(
        <div
          ref={tooltipRef}
          className="cell-tooltip"
          style={{ left: pos.x, top: pos.y }}
        >
          {tooltip}
        </div>,
        document.body,
      )}
    </>
  );
}
