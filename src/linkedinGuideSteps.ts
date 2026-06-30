export type LinkedInGuideStep = {
  n: number
  title: string
  body: string
  img: string
}

export const LINKEDIN_GUIDE_STEPS: LinkedInGuideStep[] = [
  {
    n: 1,
    title: 'Open Settings & Privacy',
    body: 'Open your LinkedIn profile menu (top-right "Me" icon) and click Settings & Privacy.',
    img: '/linkedin-sync/settings-privacy.png',
  },
  {
    n: 2,
    title: 'Open Data privacy',
    body: 'In Settings, select Data privacy from the left sidebar.',
    img: '/linkedin-sync/data-privacy.png',
  },
  {
    n: 3,
    title: 'Open Download my data',
    body: 'In the data section, press Download your data.',
    img: '/linkedin-sync/download-data.png',
  },
  {
    n: 4,
    title: 'Request the larger archive',
    body: 'Select the larger data archive, then press Request archive.',
    img: '/linkedin-sync/request-archive.png',
  },
]
