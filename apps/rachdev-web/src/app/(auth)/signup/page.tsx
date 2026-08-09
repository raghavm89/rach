import { redirect } from 'next/navigation';

// Self-serve signup has been retired — RachDev accounts are provisioned by an
// organization admin (enterprise auth). Any old /signup link now lands on sign-in.
export default function SignupPage() {
  redirect('/login');
}
