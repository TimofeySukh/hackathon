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
}

function profileSearchLink(name: string, company: string): PersonLink {
  return {
    id: `link-demo-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
    service: 'website',
    label: 'Profile',
    url: `https://www.google.com/search?q=${encodeURIComponent(`${name} ${company}`)}`,
  }
}

function demoPerson(person: DemoPerson, company: string): PersonNode {
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
    links: [profileSearchLink(person.name, company)],
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
    }, 'OpenAI'),
    demoPerson({
      id: 'demo-openai-jakub-pachocki',
      name: 'Jakub Pachocki',
      avatar: 'JP',
      circleId: 'demo-openai',
      x: -585,
      y: -288,
      note: 'Chief Scientist at OpenAI; leads core research direction after years on OpenAI research teams.',
    }, 'OpenAI'),
    demoPerson({
      id: 'demo-openai-greg-brockman',
      name: 'Greg Brockman',
      avatar: 'GB',
      circleId: 'demo-openai',
      x: -545,
      y: -165,
      note: 'Co-founder and President at OpenAI; focuses on product, engineering, and company execution.',
    }, 'OpenAI'),
    demoPerson({
      id: 'demo-openai-wojciech-zaremba',
      name: 'Wojciech Zaremba',
      avatar: 'WZ',
      circleId: 'demo-openai',
      x: -345,
      y: -174,
      note: 'Co-founder at OpenAI; researcher known for robotics, reinforcement learning, and model training work.',
    }, 'OpenAI'),
    demoPerson({
      id: 'demo-openai-sam-altman',
      name: 'Sam Altman',
      avatar: 'SA',
      circleId: 'demo-openai',
      x: -302,
      y: -248,
      note: 'Co-founder and CEO at OpenAI; leads the company strategy, partnerships, and product direction.',
    }, 'OpenAI'),
    demoPerson({
      id: 'demo-anthropic-jared-kaplan',
      name: 'Jared Kaplan',
      avatar: 'JK',
      circleId: 'demo-anthropic',
      x: 422,
      y: -260,
      note: 'Co-founder at Anthropic; researcher known for scaling-law work and model development.',
    }, 'Anthropic'),
    demoPerson({
      id: 'demo-anthropic-tom-brown',
      name: 'Tom Brown',
      avatar: 'TB',
      circleId: 'demo-anthropic',
      x: 315,
      y: -182,
      note: 'Co-founder at Anthropic; works on compute strategy and helped author influential language-model research.',
    }, 'Anthropic'),
    demoPerson({
      id: 'demo-anthropic-dario-amodei',
      name: 'Dario Amodei',
      avatar: 'DA',
      circleId: 'demo-anthropic',
      x: 548,
      y: -192,
      note: 'Co-founder and CEO at Anthropic; leads the company and its AI safety-focused model strategy.',
    }, 'Anthropic'),
    demoPerson({
      id: 'demo-anthropic-daniela-amodei',
      name: 'Daniela Amodei',
      avatar: 'DA',
      circleId: 'demo-anthropic',
      x: 338,
      y: -58,
      note: 'Co-founder and President at Anthropic; leads company operations and go-to-market execution.',
    }, 'Anthropic'),
    demoPerson({
      id: 'demo-anthropic-jack-clark',
      name: 'Jack Clark',
      avatar: 'JC',
      circleId: 'demo-anthropic',
      x: 515,
      y: -70,
      note: 'Co-founder at Anthropic; works on policy, communications, and the wider AI governance conversation.',
    }, 'Anthropic'),
    demoPerson({
      id: 'demo-google-sergey-brin',
      name: 'Sergey Brin',
      avatar: 'SB',
      circleId: 'demo-google',
      x: -295,
      y: 178,
      note: 'Google co-founder; remains an Alphabet board member and major shareholder while advising technical work.',
    }, 'Google'),
    demoPerson({
      id: 'demo-google-demis-hassabis',
      name: 'Demis Hassabis',
      avatar: 'DH',
      circleId: 'demo-google',
      x: -438,
      y: 250,
      note: 'Co-founder and CEO of Google DeepMind; leads frontier AI research and model development.',
    }, 'Google'),
    demoPerson({
      id: 'demo-google-larry-page',
      name: 'Larry Page',
      avatar: 'LP',
      circleId: 'demo-google',
      x: -380,
      y: 372,
      note: 'Google co-founder; remains an Alphabet board member and major shareholder after stepping back from daily management.',
    }, 'Google'),
    demoPerson({
      id: 'demo-google-jeff-dean',
      name: 'Jeff Dean',
      avatar: 'JD',
      circleId: 'demo-google',
      x: -230,
      y: 370,
      note: 'Google Chief Scientist; guides technical direction across AI, systems, and research teams.',
    }, 'Google'),
    demoPerson({
      id: 'demo-google-sundar-pichai',
      name: 'Sundar Pichai',
      avatar: 'SP',
      circleId: 'demo-google',
      x: -158,
      y: 258,
      note: 'CEO of Google and Alphabet; leads the company, product strategy, and AI investment priorities.',
    }, 'Google'),
  ]

  return {
    circles,
    people,
    connections: [],
  }
}
