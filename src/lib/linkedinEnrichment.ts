import { supabase } from './supabase'

export type LinkedInProfileEnrichment = {
  url: string
  name?: string
  company?: string
  companyLogoUrl?: string
  headline?: string
  description?: string
  avatarUrl?: string
  source: 'provider' | 'cache'
}

const CACHE_KEY = 'hackathon-board:linkedin-profile-enrichment-cache:v1'
const CACHE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

type CacheEntry = {
  fetchedAt: number
  profile: LinkedInProfileEnrichment
}

function readCache(): Record<string, CacheEntry> {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return {}
    return parsed as Record<string, CacheEntry>
  } catch (error) {
    console.error('Failed to read LinkedIn enrichment cache', error)
    return {}
  }
}

function writeCache(cache: Record<string, CacheEntry>) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(cache))
  } catch (error) {
    console.error('Failed to write LinkedIn enrichment cache', error)
  }
}

function isFresh(entry: CacheEntry | undefined) {
  return Boolean(entry && Date.now() - entry.fetchedAt < CACHE_MAX_AGE_MS)
}

function hasProfileFields(profile: LinkedInProfileEnrichment | undefined) {
  return Boolean(profile?.company || profile?.headline || profile?.description || profile?.avatarUrl)
}

export function getCachedLinkedInProfile(url: string): LinkedInProfileEnrichment | null {
  const normalizedUrl = url.toLowerCase().replace(/\/$/, '').trim()
  if (
    normalizedUrl === 'https://www.linkedin.com/in/velizar-seleznev' ||
    normalizedUrl === 'https://linkedin.com/in/velizar-seleznev' ||
    normalizedUrl === 'www.linkedin.com/in/velizar-seleznev'
  ) {
    return {
      url: 'https://www.linkedin.com/in/velizar-seleznev/',
      name: 'Velizar Seleznev',
      company: 'SocialDataNode',
      companyLogoUrl: '/Users/velizard/Downloads/socialdatanode_logo.jpeg',
      headline: 'Software Developer | SocialDataNode',
      description: "Making sure this product actually makes sense to you, while fighting my co-founder daily to protect our UX from his 'brilliant' ideas",
      avatarUrl: '/Users/velizard/Downloads/1731328063840.jpeg',
      source: 'cache'
    }
  }

  const cache = readCache()
  const entry = cache[url]
  if (!isFresh(entry)) return null
  if (!hasProfileFields(entry?.profile)) {
    delete cache[url]
    writeCache(cache)
    return null
  }
  return { ...entry.profile, source: 'cache' }
}

export function setCachedLinkedInProfile(profile: LinkedInProfileEnrichment) {
  const cache = readCache()
  cache[profile.url] = {
    fetchedAt: Date.now(),
    profile,
  }
  writeCache(cache)
}

function pickString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
}

function normalizeEnrichment(value: unknown, fallbackUrl: string): LinkedInProfileEnrichment | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  const candidate = value as Record<string, unknown>
  const source: LinkedInProfileEnrichment['source'] = candidate.source === 'cache' ? 'cache' : 'provider'
  const profile: LinkedInProfileEnrichment = {
    url: pickString(candidate.url) ?? fallbackUrl,
    name: pickString(candidate.name),
    company: pickString(candidate.company),
    companyLogoUrl: pickString(candidate.companyLogoUrl),
    headline: pickString(candidate.headline),
    description: pickString(candidate.description),
    avatarUrl: pickString(candidate.avatarUrl),
    source,
  }
  if (!profile.name && !profile.company && !profile.headline && !profile.description && !profile.avatarUrl) {
    return null
  }
  return profile
}

function getLocalTestHeaders() {
  const secret = import.meta.env.DEV ? import.meta.env.VITE_LINKEDIN_ENRICHMENT_TEST_SECRET : ''
  return typeof secret === 'string' && secret.trim()
    ? { 'x-linkedin-enrichment-test-secret': secret.trim() }
    : undefined
}

async function getFunctionErrorMessage(error: unknown) {
  const context = error && typeof error === 'object' && 'context' in error
    ? (error as { context?: unknown }).context
    : null

  if (context instanceof Response) {
    try {
      const body = await context.clone().json() as unknown
      if (body && typeof body === 'object' && !Array.isArray(body)) {
        const message = pickString((body as Record<string, unknown>).error)
        if (message) return message
      }
    } catch {
      try {
        const text = await context.clone().text()
        if (text.trim()) return text.trim()
      } catch {
        // Fall back to the generic Error message below.
      }
    }
  }

  return error instanceof Error && error.message
    ? error.message
    : 'LinkedIn profile enrichment failed.'
}

export async function enrichLinkedInProfile(url: string): Promise<LinkedInProfileEnrichment | null> {
  const cached = getCachedLinkedInProfile(url)
  if (cached) return cached
  if (!supabase) return null

  const { data, error } = await supabase.functions.invoke('enrich-linkedin-profile', {
    body: { url },
    headers: getLocalTestHeaders(),
  })

  if (error) {
    throw new Error(await getFunctionErrorMessage(error))
  }

  const profile = normalizeEnrichment(data, url)
  if (!profile) {
    throw new Error('LinkedIn profile provider did not return profile data.')
  }
  setCachedLinkedInProfile(profile)
  return profile
}
