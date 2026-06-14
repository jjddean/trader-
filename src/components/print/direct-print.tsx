"use client";

import { createPortal } from "react-dom";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { triggerBrowserPrint } from "@/lib/print-sheet";

export function useDirectPrint() {
  const [content, setContent] = useState<ReactNode | null>(null);

  const print = useCallback((node: ReactNode) => {
    setContent(node);
  }, []);

  useEffect(() => {
    if (!content) return;

    const onAfterPrint = () => setContent(null);
    window.addEventListener("afterprint", onAfterPrint);

    const timer = window.setTimeout(() => {
      triggerBrowserPrint();
    }, 150);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("afterprint", onAfterPrint);
    };
  }, [content]);

  const portal =
    content && typeof document !== "undefined"
      ? createPortal(
          <div id="freightcode-print-root" className="bg-white p-8 text-gray-900">
            {content}
          </div>,
          document.body,
        )
      : null;

  return { print, portal };
}
