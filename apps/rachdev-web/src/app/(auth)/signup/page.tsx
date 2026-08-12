import { redirect } from 'next/navigation';

// Signup lives on the auth page's Sign Up tab. Keep /signup as a stable entry
// point (marketing CTAs, old links) that lands directly on it.
export default function SignupPage() {
  redirect('/login?tab=signup');
}
