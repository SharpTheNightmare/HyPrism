export type OnboardingPhase = 'splash' | 'auth' | 'warning' | 'setup';
export type OnboardingStep = 'language' | 'profile' | 'hardware' | 'visual' | 'about';

export interface OnboardingState {
  phase: OnboardingPhase;
  currentStep: string;
  username: string;
  backgroundMode: string;
  selectedLanguage: string;
  isAuthenticated: boolean;
}
