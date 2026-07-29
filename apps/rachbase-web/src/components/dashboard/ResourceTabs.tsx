"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { cn } from "@rach/ui/lib/utils";

/**
 * Shared tabbed resource-view IA (Phase 2 · WS1).
 *
 * Every resource detail view (service, Postgres, VM) uses the same tab bar so
 * Console, Data, Variables, etc. each have a consistent home. The active tab is
 * synced to the `?tab=` query param, so tabs are deep-linkable and shareable.
 */

export interface ResourceTab<K extends string = string> {
  key: K;
  label: string;
  icon?: React.ComponentType<{ size?: number | string }>;
}

/**
 * Active tab backed by the `?tab=` query param (falls back to `defaultKey`).
 * Returns `[activeTab, setTab]`; `setTab` replaces the URL without scrolling.
 */
export function useResourceTab<K extends string>(
  keys: readonly K[],
  defaultKey: K,
): [K, (key: K) => void] {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const raw = searchParams.get("tab") as K | null;
  const active = raw && keys.includes(raw) ? raw : defaultKey;

  const setTab = useCallback(
    (key: K) => {
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", key);
      router.replace(`${pathname}?${params.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return [active, setTab];
}

export function ResourceTabs<K extends string>({
  tabs,
  active,
  onChange,
  className,
}: {
  tabs: readonly ResourceTab<K>[];
  active: K;
  onChange: (key: K) => void;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 flex gap-1 overflow-x-auto border-b border-neutral-border", className)}>
      {tabs.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <button
            key={t.key}
            type="button"
            onClick={() => onChange(t.key)}
            aria-current={isActive ? "page" : undefined}
            className={cn(
              "flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              isActive
                ? "border-primary-blue text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary",
            )}
          >
            {Icon && <Icon size={15} />} {t.label}
          </button>
        );
      })}
    </div>
  );
}
