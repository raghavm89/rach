// Vernacular capture languages for voice dictation / intake (Web Speech + on-prem
// ASR). English/Hindi/Punjabi lead (AFMS core); the rest cover major Indian
// languages. Shared by Scribe and Reception intake so they stay in sync.
export const DICTATION_LANGS: { code: string; label: string }[] = [
  { code: 'en-IN', label: 'English' },
  { code: 'hi-IN', label: 'Hindi' },
  { code: 'pa-IN', label: 'Punjabi' },
  { code: 'bn-IN', label: 'Bengali' },
  { code: 'mr-IN', label: 'Marathi' },
  { code: 'ta-IN', label: 'Tamil' },
  { code: 'te-IN', label: 'Telugu' },
  { code: 'kn-IN', label: 'Kannada' },
  { code: 'gu-IN', label: 'Gujarati' },
  { code: 'ml-IN', label: 'Malayalam' },
  { code: 'ur-IN', label: 'Urdu' },
];
