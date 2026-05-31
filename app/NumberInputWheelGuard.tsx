"use client";

import { useEffect } from "react";

export function NumberInputWheelGuard() {
  useEffect(() => {
    const onWheel = (event: WheelEvent) => {
      const target = event.target;

      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (target.type !== "number") {
        return;
      }

      if (document.activeElement !== target) {
        return;
      }

      target.blur();
    };

    document.addEventListener("wheel", onWheel, { capture: true });

    return () => {
      document.removeEventListener("wheel", onWheel, { capture: true });
    };
  }, []);

  return null;
}
