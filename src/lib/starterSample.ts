import type { BulkGraphPersonInput } from './graphStorage'

type StarterSampleContact = {
  firstName: string
  lastName: string
  company: string
  position: string
  connectedOn: string
}

export const STARTER_SAMPLE_CONTACTS: StarterSampleContact[] = [
  {
    firstName: 'Emily',
    lastName: 'Carter',
    company: 'Blue River Studio',
    position: 'Product Manager',
    connectedOn: '15 Jan 2023',
  },
  {
    firstName: 'Noah',
    lastName: 'Bennett',
    company: 'Northstar Analytics',
    position: 'Data Scientist',
    connectedOn: '22 Mar 2023',
  },
  {
    firstName: 'Ava',
    lastName: 'Mitchell',
    company: 'CloudForge Labs',
    position: 'UX Researcher',
    connectedOn: '04 May 2023',
  },
  {
    firstName: 'Ethan',
    lastName: 'Brooks',
    company: 'Greenfield Systems',
    position: 'Engineering Lead',
    connectedOn: '18 Jun 2023',
  },
  {
    firstName: 'Mia',
    lastName: 'Turner',
    company: 'BrightPath Consulting',
    position: 'Leadership Coach',
    connectedOn: '02 Sep 2023',
  },
  {
    firstName: 'Lucas',
    lastName: 'Reed',
    company: 'FutureOps Advisory',
    position: 'Partner',
    connectedOn: '11 Nov 2023',
  },
  {
    firstName: 'Chloe',
    lastName: 'Morgan',
    company: 'Harbor Strategy',
    position: 'OKR Consultant',
    connectedOn: '26 Feb 2024',
  },
  {
    firstName: 'Daniel',
    lastName: 'Foster',
    company: 'VentureSpring',
    position: 'Founder',
    connectedOn: '09 Aug 2024',
  },
  {
    firstName: 'Grace',
    lastName: 'Phillips',
    company: 'DeployWise',
    position: 'DevOps Consultant',
    connectedOn: '17 Oct 2024',
  },
  {
    firstName: 'Oliver',
    lastName: 'Hughes',
    company: 'ScaleCraft',
    position: 'Senior Consultant',
    connectedOn: '05 Dec 2024',
  },
]

export function buildStarterSamplePeople(input: {
  rootPersonId: string
  tagId: string
  createId: () => string
}): BulkGraphPersonInput[] {
  const radius = 320

  return STARTER_SAMPLE_CONTACTS.map((contact, index) => {
    const angle = (index / STARTER_SAMPLE_CONTACTS.length) * Math.PI * 2 - Math.PI / 2
    const name = `${contact.firstName} ${contact.lastName}`

    return {
      id: input.createId(),
      name,
      tagId: input.tagId,
      x: Math.round(Math.cos(angle) * radius),
      y: Math.round(Math.sin(angle) * radius),
      noteTitle: 'LinkedIn sample contact',
      noteBody: [
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
