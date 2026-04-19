import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')

function loadEnvFile(filePath, { override = false } = {}) {
  if (!fs.existsSync(filePath)) return

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) continue

    const separatorIndex = line.indexOf('=')
    if (separatorIndex <= 0) continue

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    if (!override && process.env[key] !== undefined) continue
    process.env[key] = value
  }
}

loadEnvFile(path.join(repoRoot, '.env.local'))
loadEnvFile(path.join(repoRoot, '.env.mcp.local'), { override: true })

const SUPABASE_URL = process.env.HACKATHON_MCP_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL
const SUPABASE_SERVICE_ROLE_KEY =
  process.env.HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing Supabase configuration. Expected .env.mcp.local with HACKATHON_MCP_SUPABASE_SERVICE_ROLE_KEY.'
  )
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const DEMO_PEOPLE = [
  {
    name: 'Maya Chen',
    tagName: 'lead',
    x: 1240,
    y: -420,
    notes: [
      {
        title: 'Relationship',
        body:
          'Met at the Copenhagen founder dinner. Strong product instinct, moves fast, and prefers concrete demos over long decks.',
      },
      {
        title: 'Opportunity',
        body:
          'Interested in using the board to track warm leads, investor follow-ups, and demo feedback across one shared flow.',
      },
      {
        title: 'Next step',
        body:
          'Send a short product walkthrough and ask whether she wants a 20-minute pilot setup next week.',
      },
    ],
    ai: {
      summary:
        'Maya Chen is a high-signal lead from the Copenhagen startup scene who responds well to crisp demos and clear follow-up.',
      structured_summary: {
        summary:
          'High-signal lead who likes concise product walkthroughs and could become an early power user for contact tracking.',
        traits: ['fast-moving', 'product-minded', 'demo-driven'],
        interests: ['founder workflows', 'warm introductions', 'lightweight CRM alternatives'],
        relationship_context: ['met at founder dinner', 'open to pilot conversation'],
        open_questions: ['Which workflow hurts most today?', 'Who else should join the first demo?'],
      },
    },
  },
  {
    name: 'Jonas Berg',
    tagName: 'client',
    x: 1680,
    y: -180,
    notes: [
      {
        title: 'Relationship',
        body:
          'Operations lead at a B2B marketplace. Practical buyer, asks about reliability first, and wants searchable contact history.',
      },
      {
        title: 'Opportunity',
        body:
          'Potential pilot customer for keeping team notes, deal context, and action items visible before internal handoffs.',
      },
      {
        title: 'Next step',
        body:
          'Show a search demo around pilot status, automation blockers, and customer priority. If it lands, move to budget discussion.',
      },
    ],
    ai: {
      summary:
        'Jonas Berg is a realistic pilot client for an operations-heavy workflow where search quality and visible next steps matter.',
      structured_summary: {
        summary:
          'Operations buyer who could validate whether the board works for real customer follow-up and internal coordination.',
        traits: ['pragmatic', 'process-oriented', 'budget-aware'],
        interests: ['searchable notes', 'handoff visibility', 'pilot rollout'],
        relationship_context: ['potential pilot client', 'cares about reliability'],
        open_questions: ['How many teammates need access?', 'What would make the pilot feel production-ready?'],
      },
    },
  },
  {
    name: 'Alina Petrova',
    tagName: 'partner',
    x: 1500,
    y: 260,
    notes: [
      {
        title: 'Relationship',
        body:
          'Runs an automation consultancy and already deploys n8n flows for startup teams. Understands implementation constraints well.',
      },
      {
        title: 'Opportunity',
        body:
          'Strong integration partner if the product can expose a clear API surface for note sync, enrichment, and search triggers.',
      },
      {
        title: 'Next step',
        body:
          'Prepare a product demo that highlights n8n sync, AI note enrichment, and a simple partner integration story.',
      },
    ],
    ai: {
      summary:
        'Alina Petrova is the best demo contact for talking about n8n, automation integrations, and partner-led distribution.',
      structured_summary: {
        summary:
          'Automation partner who can amplify the product if integrations are easy to explain and reliable to deploy.',
        traits: ['technical', 'partner-minded', 'systems thinker'],
        interests: ['n8n', 'automation consulting', 'integration APIs'],
        relationship_context: ['possible integration partner', 'understands technical tradeoffs'],
        open_questions: ['Which webhook events matter most?', 'Would she package this into existing client work?'],
      },
    },
  },
  {
    name: 'Marcus Reed',
    tagName: 'advisor',
    x: 980,
    y: 180,
    notes: [
      {
        title: 'Relationship',
        body:
          'GTM advisor with a strong eye for narrow positioning. Gives blunt feedback and is useful when the story gets vague.',
      },
      {
        title: 'Opportunity',
        body:
          'Can help frame the product as a focused relationship board instead of a generic CRM. Useful before external demos.',
      },
      {
        title: 'Next step',
        body:
          'Ask him to review the demo narrative, pricing assumptions, and the pilot offer before the next round of meetings.',
      },
    ],
    ai: {
      summary:
        'Marcus Reed is the advisor to search for when you want feedback on pricing, positioning, and how to present the pilot.',
      structured_summary: {
        summary:
          'Advisor best used for sharpening the story, de-risking the pilot offer, and pressure-testing pricing language.',
        traits: ['direct', 'commercial', 'positioning-focused'],
        interests: ['pricing', 'pilot design', 'GTM messaging'],
        relationship_context: ['trusted advisor for demo narrative'],
        open_questions: ['Should pricing anchor on seats or workflow value?', 'What claim feels strongest in a live demo?'],
      },
    },
  },
  {
    name: 'Sofia Lind',
    tagName: 'builder',
    x: 1160,
    y: 560,
    notes: [
      {
        title: 'Relationship',
        body:
          'Product designer from Copenhagen who likes graph interfaces, visual hierarchy, and clean interaction models.',
      },
      {
        title: 'Opportunity',
        body:
          'Great collaborator for tightening the search panel, note organization, and visual grouping before the demo.',
      },
      {
        title: 'Next step',
        body:
          'Share the latest board flow and ask for feedback on the design system, search results, and inspector readability.',
      },
    ],
    ai: {
      summary:
        'Sofia Lind is the builder to find when the conversation is about design system polish, graph UX, and demo clarity.',
      structured_summary: {
        summary:
          'Design-focused builder who can help make the interface feel more intentional and easier to present live.',
        traits: ['visual', 'systematic', 'detail-oriented'],
        interests: ['design systems', 'graph UX', 'interaction polish'],
        relationship_context: ['builder contact for UI refinement'],
        open_questions: ['Which search result details should stay visible?', 'How much visual structure is enough for the demo?'],
      },
    },
  },
  {
    name: 'Daniel Novak',
    tagName: 'friend',
    x: 720,
    y: -140,
    notes: [
      {
        title: 'Relationship',
        body:
          'Well connected in the local founder community. Warm and easy to work with, especially for informal introductions.',
      },
      {
        title: 'Opportunity',
        body:
          'Best contact for warm intros to founders, operators, and angel investors who react well to quick demos and clear asks.',
      },
      {
        title: 'Next step',
        body:
          'Ask for two warm introductions after the next demo build is stable: one founder and one operator with an automation pain point.',
      },
    ],
    ai: {
      summary:
        'Daniel Novak is the friend contact for warm intros, startup community access, and low-friction demo distribution.',
      structured_summary: {
        summary:
          'Community connector who is most valuable when the ask is specific and easy to forward to the right person.',
        traits: ['warm', 'connected', 'helpful'],
        interests: ['warm intros', 'founder community', 'angel introductions'],
        relationship_context: ['friend with strong network access'],
        open_questions: ['Who is best for an honest product reaction?', 'Should the ask target founders or operators first?'],
      },
    },
  },
  {
    name: 'Priya Raman',
    tagName: 'client',
    x: 1860,
    y: 420,
    notes: [
      {
        title: 'Relationship',
        body:
          'Heads operations at a healthtech startup. Cares about clean audit trails, searchable relationship context, and fast onboarding.',
      },
      {
        title: 'Opportunity',
        body:
          'Interesting client candidate if the board can show healthtech partnerships, pilot blockers, and follow-up notes in one place.',
      },
      {
        title: 'Next step',
        body:
          'Demo a search flow using healthtech partnerships, onboarding blockers, and next-step tracking to test real interest.',
      },
    ],
    ai: {
      summary:
        'Priya Raman is a strong healthtech client candidate where searchable history and clear workflow ownership matter.',
      structured_summary: {
        summary:
          'Healthtech operations lead who may buy if the board reduces handoff friction and preserves relationship context.',
        traits: ['compliance-aware', 'operational', 'structured'],
        interests: ['healthtech partnerships', 'onboarding workflows', 'searchable history'],
        relationship_context: ['client candidate in healthtech'],
        open_questions: ['How important is permissioning?', 'Would the team use this during onboarding or only sales handoff?'],
      },
    },
  },
]

const DEMO_CONNECTIONS = [
  ['Maya Chen', 'Marcus Reed'],
  ['Maya Chen', 'Daniel Novak'],
  ['Jonas Berg', 'Alina Petrova'],
  ['Jonas Berg', 'Priya Raman'],
  ['Alina Petrova', 'Sofia Lind'],
  ['Marcus Reed', 'Sofia Lind'],
  ['Daniel Novak', 'Maya Chen'],
]

function parseArgs(argv) {
  const args = {
    email: '',
  }

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index]
    const next = argv[index + 1]

    if (token === '--email' && next) {
      args.email = next.trim().toLowerCase()
      index += 1
    }
  }

  return args
}

function canonicalPair(a, b) {
  return a < b ? [a, b] : [b, a]
}

async function ensureTagIds(userId, desiredTags) {
  const { data: existingTags, error: existingTagsError } = await supabase
    .from('tags')
    .select('id,name,normalized_name')
    .eq('user_id', userId)

  if (existingTagsError) {
    throw existingTagsError
  }

  const tagByName = new Map(
    (existingTags ?? []).map((tag) => [String(tag.normalized_name), { id: String(tag.id), name: String(tag.name) }])
  )
  const missingTags = desiredTags.filter((tagName) => !tagByName.has(tagName.toLowerCase()))

  if (missingTags.length > 0) {
    const { error: insertTagsError } = await supabase.from('tags').insert(
      missingTags.map((tagName) => ({
        user_id: userId,
        name: tagName,
      }))
    )

    if (insertTagsError) {
      throw insertTagsError
    }
  }

  const { data: allTags, error: allTagsError } = await supabase
    .from('tags')
    .select('id,name,normalized_name')
    .eq('user_id', userId)

  if (allTagsError) {
    throw allTagsError
  }

  return new Map((allTags ?? []).map((tag) => [String(tag.normalized_name), String(tag.id)]))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (!args.email) {
    console.error('Usage: npm run seed:demo-user -- --email <user-email>')
    process.exit(1)
  }

  const { data: userRow, error: userError } = await supabase
    .from('profiles')
    .select('id,email')
    .eq('email', args.email)
    .single()

  if (userError) {
    throw userError
  }

  const userId = String(userRow.id)
  const { data: boardRow, error: boardError } = await supabase
    .from('boards')
    .select('id,title')
    .eq('user_id', userId)
    .single()

  if (boardError) {
    throw boardError
  }

  const boardId = String(boardRow.id)

  const desiredTagNames = [...new Set(DEMO_PEOPLE.map((person) => person.tagName))]
  const tagIdsByName = await ensureTagIds(userId, desiredTagNames)

  const demoNames = DEMO_PEOPLE.map((person) => person.name)
  const { data: existingPeople, error: existingPeopleError } = await supabase
    .from('people')
    .select('id,name,is_root')
    .eq('board_id', boardId)
    .in('name', demoNames)

  if (existingPeopleError) {
    throw existingPeopleError
  }

  const existingPeopleByName = new Map((existingPeople ?? []).map((person) => [String(person.name), String(person.id)]))
  const missingPeople = DEMO_PEOPLE.filter((person) => !existingPeopleByName.has(person.name))

  if (missingPeople.length > 0) {
    const { error: insertPeopleError } = await supabase.from('people').insert(
      missingPeople.map((person) => ({
        board_id: boardId,
        owner_user_id: userId,
        name: person.name,
        tag_id: tagIdsByName.get(person.tagName.toLowerCase()) ?? null,
        x: person.x,
        y: person.y,
      }))
    )

    if (insertPeopleError) {
      throw insertPeopleError
    }
  }

  const { data: allPeople, error: allPeopleError } = await supabase
    .from('people')
    .select('id,name,is_root')
    .eq('board_id', boardId)
    .in('name', demoNames)

  if (allPeopleError) {
    throw allPeopleError
  }

  const demoPeopleByName = new Map((allPeople ?? []).map((person) => [String(person.name), String(person.id)]))
  const { data: rootPerson, error: rootPersonError } = await supabase
    .from('people')
    .select('id,name')
    .eq('board_id', boardId)
    .eq('is_root', true)
    .single()

  if (rootPersonError) {
    throw rootPersonError
  }

  for (const person of DEMO_PEOPLE) {
    const personId = demoPeopleByName.get(person.name)
    if (!personId) {
      throw new Error(`Missing seeded person: ${person.name}`)
    }

    const { error: updatePersonError } = await supabase
      .from('people')
      .update({
        tag_id: tagIdsByName.get(person.tagName.toLowerCase()) ?? null,
        x: person.x,
        y: person.y,
      })
      .eq('id', personId)

    if (updatePersonError) {
      throw updatePersonError
    }

    const { error: deleteNotesError } = await supabase.from('notes').delete().eq('person_id', personId)

    if (deleteNotesError) {
      throw deleteNotesError
    }

    const { error: insertNotesError } = await supabase.from('notes').insert(
      person.notes.map((note) => ({
        person_id: personId,
        owner_user_id: userId,
        title: note.title,
        body: note.body,
      }))
    )

    if (insertNotesError) {
      throw insertNotesError
    }

    const { error: upsertAiError } = await supabase.from('person_ai_notes').upsert(
      {
        person_id: personId,
        owner_user_id: userId,
        status: 'created',
        summary: person.ai.summary,
        structured_summary: person.ai.structured_summary,
        error_message: null,
      },
      {
        onConflict: 'person_id',
      }
    )

    if (upsertAiError) {
      throw upsertAiError
    }
  }

  const allConnectionPairs = [
    ...DEMO_PEOPLE.map((person) => [String(rootPerson.id), demoPeopleByName.get(person.name)]),
    ...DEMO_CONNECTIONS.map(([firstName, secondName]) => [
      demoPeopleByName.get(firstName),
      demoPeopleByName.get(secondName),
    ]),
  ]

  for (const pair of allConnectionPairs) {
    if (!pair[0] || !pair[1] || pair[0] === pair[1]) continue
    const [personAId, personBId] = canonicalPair(pair[0], pair[1])

    const { error: connectionError } = await supabase.from('connections').upsert(
      {
        board_id: boardId,
        owner_user_id: userId,
        person_a_id: personAId,
        person_b_id: personBId,
      },
      {
        onConflict: 'board_id,person_a_id,person_b_id',
        ignoreDuplicates: true,
      }
    )

    if (connectionError) {
      throw connectionError
    }
  }

  console.log(
    JSON.stringify(
      {
        email: args.email,
        boardId,
        seeded_people: DEMO_PEOPLE.map((person) => person.name),
        root_person: rootPerson.name,
      },
      null,
      2
    )
  )
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
