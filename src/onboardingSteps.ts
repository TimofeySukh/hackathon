export type OnboardingSurface = 'desktop' | 'mobile'
export type OnboardingAction =
  | 'mode'
  | 'navigate'
  | 'create-person'
  | 'create-circle'
  | 'organize'
  | 'select'
  | 'search-import'
  | 'linkedin-import'
  | 'settings'
  | 'linkedin-guide'

export type OnboardingHint = {
  id: string
  trigger: OnboardingAction
  text: string
}

const DESKTOP_ONBOARDING_HINTS: OnboardingHint[] = [
  {
    id: 'pan',
    trigger: 'navigate',
    text: 'Drag empty space to pan',
  },
  {
    id: 'create-person',
    trigger: 'create-person',
    text: 'Double-click empty space to add a person',
  },
  {
    id: 'create-circle',
    trigger: 'create-circle',
    text: 'Drag from a circle center to create a circle',
  },
  {
    id: 'select-area',
    trigger: 'select',
    text: 'Right-drag empty space to select an area',
  },
  {
    id: 'search',
    trigger: 'search-import',
    text: 'Open Search to find people or circles',
  },
  {
    id: 'linkedin-profile',
    trigger: 'linkedin-import',
    text: 'Paste a LinkedIn profile link in Search',
  },
  {
    id: 'settings',
    trigger: 'settings',
    text: 'Open Settings for imports and account controls',
  },
  {
    id: 'linkedin-archive',
    trigger: 'linkedin-guide',
    text: 'Open the LinkedIn archive guide in Settings',
  },
]

const MOBILE_ONBOARDING_HINTS: OnboardingHint[] = [
  {
    id: 'mode',
    trigger: 'mode',
    text: 'Choose Edit, Select, or Pan mode',
  },
  {
    id: 'pan',
    trigger: 'navigate',
    text: 'Use Pan mode to move; pinch to zoom',
  },
  {
    id: 'create-person',
    trigger: 'create-person',
    text: 'Double-tap empty space to add a person',
  },
  {
    id: 'create-circle',
    trigger: 'create-circle',
    text: 'Drag from a circle center to create a circle',
  },
  {
    id: 'select-area',
    trigger: 'select',
    text: 'Use Select mode to choose an area',
  },
  {
    id: 'search',
    trigger: 'search-import',
    text: 'Open Search to find people or circles',
  },
  {
    id: 'linkedin-profile',
    trigger: 'linkedin-import',
    text: 'Paste a LinkedIn profile link in Search',
  },
  {
    id: 'settings',
    trigger: 'settings',
    text: 'Open Settings for imports and account controls',
  },
  {
    id: 'linkedin-archive',
    trigger: 'linkedin-guide',
    text: 'Request LinkedIn archives from a computer',
  },
]

export function getOnboardingHints(surface: OnboardingSurface): OnboardingHint[] {
  return surface === 'mobile' ? MOBILE_ONBOARDING_HINTS : DESKTOP_ONBOARDING_HINTS
}
