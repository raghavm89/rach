'use client';

import { useMemo } from 'react';
import type { IndustryConfig } from '@/lib/industries/types';

/**
 * Agent feed seam.
 *
 * The industry-demo components render from a scripted `IndustryConfig` ("mock").
 * The SAME components power the authenticated hospital workspace by swapping the
 * data source to "live" (the tenant's real agent runs via the agent API).
 *
 * Sprint 1 establishes the seam: `useAgentFeed` returns the config to render and
 * flags whether it is live. A later sprint wires the live branch to /api/agent.
 */
export type AgentFeedSource = 'mock' | 'live';

export interface AgentFeed {
  source: AgentFeedSource;
  isLive: boolean;
  config: IndustryConfig;
}

export function useAgentFeed(
  config: IndustryConfig,
  source: AgentFeedSource = 'mock',
): AgentFeed {
  // TODO (later sprint): when source === 'live', subscribe to the agent API
  //   (SSE from /api/agent/...) and overlay real agent status onto `config`.
  return useMemo<AgentFeed>(
    () => ({ source, isLive: source === 'live', config }),
    [source, config],
  );
}
