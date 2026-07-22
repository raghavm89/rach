import { redirect } from 'next/navigation';

/**
 * /signup used to be a second, partial signup screen: OAuth buttons plus a
 * "Sign up with Email →" link that bounced to /login?tab=signup anyway. That
 * meant two entry points, the OAuth markup duplicated verbatim, and — worst —
 * the Terms and Privacy notice living here rather than on the form people
 * actually submit.
 *
 * The real form is the signup tab on /login. This is now just a redirect, so
 * existing links, bookmarks and ad campaigns pointing at /signup keep working.
 */
export default function SignupPage() {
  redirect('/login?tab=signup');
}
