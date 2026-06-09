import type { BulkGraphPersonInput } from './graphStorage'

type StarterSampleContact = {
  firstName: string
  lastName: string
  company: string
  position: string
  connectedOn: string
  tagName: string
  noteTitle: string
  noteBody: string
}

export const STARTER_SAMPLE_TAGS = [
  { name: 'Product', color: '#1e90ff' },
  { name: 'Data', color: '#8affd6' },
  { name: 'Research', color: '#ff7eb6' },
  { name: 'Engineering', color: '#4cd137' },
  { name: 'Leadership', color: '#ffd93d' },
  { name: 'Advisory', color: '#a55eea' },
  { name: 'Strategy', color: '#ff9f43' },
  { name: 'Founder', color: '#ff6b6b' },
  { name: 'Infrastructure', color: '#2ed573' },
  { name: 'Growth', color: '#3742fa' },
] as const

export const STARTER_SAMPLE_CONTACTS: StarterSampleContact[] = [
  {
    firstName: 'Emily',
    lastName: 'Carter',
    company: 'Blue River Studio',
    position: 'Product Manager',
    connectedOn: '15 Jan 2023',
    tagName: 'Product',
    noteTitle: 'Product intro',
    noteBody: 'Good person to ask about onboarding funnels, activation metrics, and product-led growth experiments.',
  },
  {
    firstName: 'Noah',
    lastName: 'Bennett',
    company: 'Northstar Analytics',
    position: 'Data Scientist',
    connectedOn: '22 Mar 2023',
    tagName: 'Data',
    noteTitle: 'Analytics expert',
    noteBody: 'Knows event pipelines and can sanity-check search ranking metrics before a bigger AI pass.',
  },
  {
    firstName: 'Ava',
    lastName: 'Mitchell',
    company: 'CloudForge Labs',
    position: 'UX Researcher',
    connectedOn: '04 May 2023',
    tagName: 'Research',
    noteTitle: 'User research',
    noteBody: 'Strong at interview scripts and pattern finding; ask for feedback on the first-run experience.',
  },
  {
    firstName: 'Ethan',
    lastName: 'Brooks',
    company: 'Greenfield Systems',
    position: 'Engineering Lead',
    connectedOn: '18 Jun 2023',
    tagName: 'Engineering',
    noteTitle: 'Engineering review',
    noteBody: 'Can review import performance, graph rendering tradeoffs, and backend reliability risks.',
  },
  {
    firstName: 'Mia',
    lastName: 'Turner',
    company: 'BrightPath Consulting',
    position: 'Leadership Coach',
    connectedOn: '02 Sep 2023',
    tagName: 'Leadership',
    noteTitle: 'Leadership context',
    noteBody: 'Useful for warm intros to operators and for sharpening the story around relationship memory.',
  },
  {
    firstName: 'Lucas',
    lastName: 'Reed',
    company: 'FutureOps Advisory',
    position: 'Partner',
    connectedOn: '11 Nov 2023',
    tagName: 'Advisory',
    noteTitle: 'Advisor lead',
    noteBody: 'Ask about GTM partnerships and which founder communities care about network search.',
  },
  {
    firstName: 'Chloe',
    lastName: 'Morgan',
    company: 'Harbor Strategy',
    position: 'OKR Consultant',
    connectedOn: '26 Feb 2024',
    tagName: 'Strategy',
    noteTitle: 'Planning help',
    noteBody: 'Can help turn messy contact data into practical relationship workflows for teams.',
  },
  {
    firstName: 'Daniel',
    lastName: 'Foster',
    company: 'VentureSpring',
    position: 'Founder',
    connectedOn: '09 Aug 2024',
    tagName: 'Founder',
    noteTitle: 'Founder feedback',
    noteBody: 'Good early tester for whether the graph makes it easier to remember why a person matters.',
  },
  {
    firstName: 'Grace',
    lastName: 'Phillips',
    company: 'DeployWise',
    position: 'DevOps Consultant',
    connectedOn: '17 Oct 2024',
    tagName: 'Infrastructure',
    noteTitle: 'Infra advice',
    noteBody: 'Ask about secure deploy defaults, data export expectations, and production observability.',
  },
  {
    firstName: 'Oliver',
    lastName: 'Hughes',
    company: 'ScaleCraft',
    position: 'Senior Consultant',
    connectedOn: '05 Dec 2024',
    tagName: 'Growth',
    noteTitle: 'Growth consultant',
    noteBody: 'Useful for positioning, retention loops, and finding the right ICP for a searchable network graph.',
  },
]

export function buildStarterSamplePeople(input: {
  rootPersonId: string
  tagIdsByName: Record<string, string>
  createId: () => string
}): BulkGraphPersonInput[] {
  const radius = 320

  return STARTER_SAMPLE_CONTACTS.map((contact, index) => {
    const angle = (index / STARTER_SAMPLE_CONTACTS.length) * Math.PI * 2 - Math.PI / 2
    const name = `${contact.firstName} ${contact.lastName}`

    return {
      id: input.createId(),
      name,
      tagId: input.tagIdsByName[contact.tagName] ?? null,
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
      noteTitle: contact.noteTitle,
      noteBody: [
        contact.noteBody,
        '',
        `Position/headline: ${contact.position}`,
        `Company: ${contact.company}`,
        `Connected on: ${contact.connectedOn}`,
        `Imported LinkedIn name: ${name}`,
        'Source: LinkedIn sample starter graph',
      ].join('\n'),
      connectToPersonId: input.rootPersonId,
    }
  })
}
