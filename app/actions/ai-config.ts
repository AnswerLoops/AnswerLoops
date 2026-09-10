'use server'

import { z } from 'zod'
import { requireOrgAccess } from '@/lib/auth/org'
import { saveOrgAIConfig, deleteOrgAIConfig } from '@/lib/db/queries/ai-config'
import { planRequiredFor } from '@/lib/billing/entitlements'
import { orgHasFeature } from '@/lib/billing/entitlements-server'
import { PLANS } from '@/lib/billing/plans'

const CHAT_PROVIDERS = ['openai', 'anthropic', 'google', 'groq', 'mistral', 'openai-compatible'] as const
const EMBEDDING_PROVIDERS = ['openai', 'openai-compatible'] as const

const SaveSchema = z.object({
  chat_provider: z.enum(CHAT_PROVIDERS),
  chat_model: z.string().min(1).max(200),
  chat_api_key: z.string().max(500).optional(),
  chat_base_url: z.string().url().max(500).optional().or(z.literal('')),
  embedding_provider: z.enum(EMBEDDING_PROVIDERS),
  embedding_model: z.string().min(1).max(200),
  embedding_api_key: z.string().max(500).optional(),
  embedding_base_url: z.string().url().max(500).optional().or(z.literal('')),
})

export async function saveAIConfigAction(
  _prevState: unknown,
  formData: FormData
): Promise<{ error?: string } | null> {
  // The org's model provider + API keys are org-wide credentials — the same
  // sensitivity class as API keys and ownership transfer, so owner/admin only,
  // and resolved from a real membership row (never a default-org fallback).
  const access = await requireOrgAccess(['owner', 'admin'])
  if (!access.ok) return { error: access.error }
  const { orgId } = access

  const raw = Object.fromEntries(formData)
  const parsed = SaveSchema.safeParse(raw)
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' }

  const d = parsed.data

  // Bring-your-own-key with a named provider (OpenAI, Anthropic, Google, Groq,
  // Mistral) is included on every plan — see the pricing comparison table's
  // "Bring your own AI provider" row. Only an arbitrary custom endpoint
  // ('openai-compatible', e.g. a self-hosted/local model with its own base
  // URL) is the Enterprise-gated "Custom AI model configuration" row; gating
  // the whole form blocked the exact escape hatch the trial-exhausted banner
  // tells every org, on every plan, to use.
  const isCustomEndpoint = d.chat_provider === 'openai-compatible' || d.embedding_provider === 'openai-compatible'
  if (isCustomEndpoint && !(await orgHasFeature(orgId, 'custom_ai_model_config'))) {
    const requiredPlan = planRequiredFor('custom_ai_model_config')
    return { error: `Custom AI model configuration is available on the ${PLANS[requiredPlan].name} plan and above.` }
  }
  await saveOrgAIConfig(orgId, {
    chat_provider: d.chat_provider,
    chat_model: d.chat_model,
    chat_api_key: d.chat_api_key || null,
    chat_base_url: d.chat_base_url || null,
    embedding_provider: d.embedding_provider,
    embedding_model: d.embedding_model,
    embedding_api_key: d.embedding_api_key || null,
    embedding_base_url: d.embedding_base_url || null,
  })

  return null
}

export async function clearAIConfigAction(
  _prevState: unknown,
  _formData: FormData
): Promise<{ error?: string } | null> {
  const access = await requireOrgAccess(['owner', 'admin'])
  if (!access.ok) return { error: access.error }

  await deleteOrgAIConfig(access.orgId)
  return null
}
