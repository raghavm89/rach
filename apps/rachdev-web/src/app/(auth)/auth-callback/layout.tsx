// Override the (auth) group layout — auth-callback is just a full-screen spinner,
// it doesn't need the split panel design.
export default function AuthCallbackLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
