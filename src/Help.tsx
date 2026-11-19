import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { CircleHelp } from "lucide-react";

/** Contextual, touch-friendly help without native title delays or clipped containers. */
export function Help({
  label,
  children,
  trigger,
  className,
}: {
  label: string;
  children: ReactNode;
  trigger?: ReactNode;
  className?: string;
}) {
  const id = useId();
  const anchor = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const pinned = useRef(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout>>();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const cancelClose = () => clearTimeout(closeTimer.current);
  const close = () => {
    cancelClose();
    pinned.current = false;
    setOpen(false);
  };
  const leave = () => {
    cancelClose();
    if (!pinned.current && document.activeElement !== anchor.current)
      closeTimer.current = setTimeout(() => setOpen(false), 140);
  };
  useEffect(() => () => clearTimeout(closeTimer.current), []);
  useEffect(() => {
    if (!open) return;
    const outside = (e: PointerEvent) => {
      if (
        !anchor.current?.contains(e.target as Node) &&
        !panel.current?.contains(e.target as Node)
      )
        close();
    };
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      if (!anchor.current || !panel.current) return;
      const a = anchor.current.getBoundingClientRect(),
        p = panel.current.getBoundingClientRect();
      const left = Math.max(
        12,
        Math.min(a.right - p.width, window.innerWidth - p.width - 12),
      );
      const top =
        a.bottom + p.height + 10 <= window.innerHeight - 12
          ? a.bottom + 8
          : Math.max(12, a.top - p.height - 8);
      setPosition({ top, left });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);
  return (
    <>
      <button
        ref={anchor}
        type="button"
        className={className ?? "help-trigger"}
        aria-label={`${label} 도움말`}
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        aria-describedby={open ? id : undefined}
        onPointerEnter={(e) => {
          if (e.pointerType === "mouse") {
            cancelClose();
            setOpen(true);
          }
        }}
        onPointerLeave={leave}
        onFocus={() => {
          cancelClose();
          setOpen(true);
        }}
        onBlur={close}
        onClick={() => {
          cancelClose();
          pinned.current = !pinned.current;
          setOpen(pinned.current);
        }}
      >
        {trigger ?? <CircleHelp size={16} aria-hidden="true" />}
      </button>
      {open &&
        createPortal(
          <div
            ref={panel}
            id={id}
            role="tooltip"
            className="help-popover"
            style={position}
            onPointerEnter={cancelClose}
            onPointerLeave={leave}
          >
            {children}
          </div>,
          document.body,
        )}
    </>
  );
}
