/**
 * Runs discovery with visible step progress — local harness or LLM via graph-api.
 */

import type { Session } from '@supabase/supabase-js'

import type { AgentDiscoveryResponse, AgentDiscoveryStep } from '../agentDiscovery'
import { discoverSyntheticGraph } from '../agentDiscovery'
import type { GraphState } from '../board/types'
import { runLocalDiscovery, runLocalFlatSearch } from './localDiscoveryEngine'
import { slimGraphForLabApi } from './slimGraphForLabApi'

const STEP_DELAY_MS = 320

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

export type DiscoveryEngine = 'local' | 'llm'

export type DiscoveryRunMeta = {
  engine: DiscoveryEngine
  llmCalls: number
  elapsedMs: number
  error?: string
}

export async function runDiscoveryWithProgress(
  graph: GraphState,
  query: string,
  organizeWithAi: boolean,
  engine: DiscoveryEngine,
  session: Session | null,
  onStep: (step: AgentDiscoveryStep, index: number, total: number) => void,
  onWaiting?: (message: string) => void,
): Promise<{
  discovery: AgentDiscoveryResponse | null
  flat: ReturnType<typeof runLocalFlatSearch> | null
  meta: DiscoveryRunMeta
}> {
  const started = performance.now()

  if (engine === 'llm' && session && organizeWithAi) {
    onWaiting?.('Calling LLM agent on server (plan → match → verify)…')
    onStep({
      id: 'llm-wait',
      label: 'Waiting for LLM agent',
      detail: 'Helper plans groups; worker matches batches; helper verifies',
    }, 0, 1)

    try {
      const discovery = await discoverSyntheticGraph(session, slimGraphForLabApi(graph), query)
      const steps = discovery.steps

      for (let index = 0; index < steps.length; index += 1) {
        onStep(steps[index], index, steps.length)
        await sleep(STEP_DELAY_MS)
      }

      return {
        discovery,
        flat: null,
        meta: {
          engine: 'llm',
          llmCalls: discovery.llmCalls ?? 0,
          elapsedMs: Math.round(performance.now() - started),
        },
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return {
        discovery: null,
        flat: null,
        meta: {
          engine: 'llm',
          llmCalls: 0,
          elapsedMs: Math.round(performance.now() - started),
          error: message,
        },
      }
    }
  }

  const result = organizeWithAi ? runLocalDiscovery(graph, query) : null
  const flat = organizeWithAi ? null : runLocalFlatSearch(graph, query)
  const steps = result?.steps ?? flat?.steps ?? []

  for (let index = 0; index < steps.length; index += 1) {
    onStep(steps[index], index, steps.length)
    await sleep(STEP_DELAY_MS)
  }

  return {
    discovery: result,
    flat,
    meta: {
      engine: 'local',
      llmCalls: 0,
      elapsedMs: Math.round(performance.now() - started),
    },
  }
}
