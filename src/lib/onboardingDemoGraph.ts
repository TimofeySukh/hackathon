import { makeCircle } from './board/layout'
import type { GraphState, PersonLink, PersonNode } from './board/types'

type DemoPerson = {
  id: string
  name: string
  avatar: string
  circleId: string
  x: number
  y: number
  note: string
  link: {
    service: PersonLink['service']
    label: string
    url: string
  }
}

function demoProfileLink(person: DemoPerson): PersonLink {
  return {
    id: `link-demo-${person.id}`,
    service: person.link.service,
    label: person.link.label,
    url: person.link.url,
  }
}

function demoPerson(person: DemoPerson): PersonNode {
  return {
    id: person.id,
    name: person.name,
    x: person.x,
    y: person.y,
    circleId: person.circleId,
    avatar: person.avatar,
    shapeType: 'circle',
    sides: 25,
    amplitude: 0,
    notes: [
      {
        id: `note-demo-${person.id}`,
        title: 'Role',
        body: person.note,
      },
    ],
    links: [demoProfileLink(person)],
  }
}

export function createOnboardingDemoGraph(): GraphState {
  const circles = [
    makeCircle('you', 'You', 'YOU', 0, 0, 104, null, null, 'blue'),
    makeCircle('demo-openai', 'OpenAI', 'OP', -460, -250, 190, null, null, 'blue'),
    makeCircle('demo-anthropic', 'Anthropic', 'AN', 430, -140, 190, null, null, 'red'),
    makeCircle('demo-google', 'Google', 'GO', -300, 300, 190, null, null, 'green'),
  ]

  const people = [
    demoPerson({
      id: 'demo-openai-ilya-sutskever',
      name: 'Ilya Sutskever',
      avatar: 'IS',
      circleId: 'demo-openai',
      x: -455,
      y: -358,
      note: 'Co-founder and former Chief Scientist at OpenAI; helped lead research behind major frontier model work.',
      link: { service: 'x', label: 'X', url: 'https://x.com/ilyasut' },
    }),
    demoPerson({
      id: 'demo-openai-jakub-pachocki',
      name: 'Jakub Pachocki',
      avatar: 'JP',
      circleId: 'demo-openai',
      x: -585,
      y: -288,
      note: 'Chief Scientist at OpenAI; leads core research direction after years on OpenAI research teams.',
      link: { service: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/jakub-pachocki' },
    }),
    demoPerson({
      id: 'demo-openai-greg-brockman',
      name: 'Greg Brockman',
      avatar: 'GB',
      circleId: 'demo-openai',
      x: -545,
      y: -165,
      note: 'Co-founder and President at OpenAI; focuses on product, engineering, and company execution.',
      link: { service: 'x', label: 'X', url: 'https://x.com/gdb' },
    }),
    demoPerson({
      id: 'demo-openai-wojciech-zaremba',
      name: 'Wojciech Zaremba',
      avatar: 'WZ',
      circleId: 'demo-openai',
      x: -345,
      y: -174,
      note: 'Co-founder at OpenAI; researcher known for robotics, reinforcement learning, and model training work.',
      link: { service: 'x', label: 'X', url: 'https://x.com/woj_zaremba' },
    }),
    demoPerson({
      id: 'demo-openai-sam-altman',
      name: 'Sam Altman',
      avatar: 'SA',
      circleId: 'demo-openai',
      x: -302,
      y: -248,
      note: 'Co-founder and CEO at OpenAI; leads the company strategy, partnerships, and product direction.',
      link: { service: 'x', label: 'X', url: 'https://x.com/sama' },
    }),
    demoPerson({
      id: 'demo-anthropic-jared-kaplan',
      name: 'Jared Kaplan',
      avatar: 'JK',
      circleId: 'demo-anthropic',
      x: 422,
      y: -260,
      note: 'Co-founder at Anthropic; researcher known for scaling-law work and model development.',
      link: { service: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/jared-kaplan-645843213' },
    }),
    demoPerson({
      id: 'demo-anthropic-tom-brown',
      name: 'Tom Brown',
      avatar: 'TB',
      circleId: 'demo-anthropic',
      x: 315,
      y: -182,
      note: 'Co-founder at Anthropic; works on compute strategy and helped author influential language-model research.',
      link: { service: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/nottombrown' },
    }),
    demoPerson({
      id: 'demo-anthropic-dario-amodei',
      name: 'Dario Amodei',
      avatar: 'DA',
      circleId: 'demo-anthropic',
      x: 548,
      y: -192,
      note: 'Co-founder and CEO at Anthropic; leads the company and its AI safety-focused model strategy.',
      link: { service: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/dario-amodei-3934934' },
    }),
    demoPerson({
      id: 'demo-anthropic-daniela-amodei',
      name: 'Daniela Amodei',
      avatar: 'DA',
      circleId: 'demo-anthropic',
      x: 338,
      y: -58,
      note: 'Co-founder and President at Anthropic; leads company operations and go-to-market execution.',
      link: { service: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/daniela-amodei-790bb22a' },
    }),
    demoPerson({
      id: 'demo-anthropic-jack-clark',
      name: 'Jack Clark',
      avatar: 'JC',
      circleId: 'demo-anthropic',
      x: 515,
      y: -70,
      note: 'Co-founder at Anthropic; works on policy, communications, and the wider AI governance conversation.',
      link: { service: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/jack-clark-5a320317' },
    }),
    demoPerson({
      id: 'demo-google-sergey-brin',
      name: 'Sergey Brin',
      avatar: 'SB',
      circleId: 'demo-google',
      x: -295,
      y: 178,
      note: 'Google co-founder; remains an Alphabet board member and major shareholder while advising technical work.',
      link: { service: 'website', label: 'Forbes profile', url: 'https://www.forbes.com/profile/sergey-brin/' },
    }),
    demoPerson({
      id: 'demo-google-demis-hassabis',
      name: 'Demis Hassabis',
      avatar: 'DH',
      circleId: 'demo-google',
      x: -438,
      y: 250,
      note: 'Co-founder and CEO of Google DeepMind; leads frontier AI research and model development.',
      link: { service: 'x', label: 'X', url: 'https://x.com/demishassabis' },
    }),
    demoPerson({
      id: 'demo-google-larry-page',
      name: 'Larry Page',
      avatar: 'LP',
      circleId: 'demo-google',
      x: -380,
      y: 372,
      note: 'Google co-founder; remains an Alphabet board member and major shareholder after stepping back from daily management.',
      link: { service: 'linkedin', label: 'LinkedIn', url: 'https://www.linkedin.com/in/larrypage' },
    }),
    demoPerson({
      id: 'demo-google-jeff-dean',
      name: 'Jeff Dean',
      avatar: 'JD',
      circleId: 'demo-google',
      x: -230,
      y: 370,
      note: 'Google Chief Scientist; guides technical direction across AI, systems, and research teams.',
      link: { service: 'website', label: 'Google Research', url: 'https://research.google/people/jeff/' },
    }),
    demoPerson({
      id: 'demo-google-sundar-pichai',
      name: 'Sundar Pichai',
      avatar: 'SP',
      circleId: 'demo-google',
      x: -158,
      y: 258,
      note: 'CEO of Google and Alphabet; leads the company, product strategy, and AI investment priorities.',
      link: { service: 'x', label: 'X', url: 'https://x.com/sundarpichai' },
    }),
  ]

  return {
    circles,
    people,
    connections: [],
  }
}
