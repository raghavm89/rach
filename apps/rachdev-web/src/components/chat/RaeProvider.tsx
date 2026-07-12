"use client";

import { Toaster } from "sonner";
import { RaeWidget } from "./RaeWidget";

/**
 * Mounts the site-wide Rae concierge widget plus the toast surface used for
 * lead-submission feedback. Rendered once in the public layout.
 */
export function RaeProvider() {
  return (
    <>
      <RaeWidget />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
