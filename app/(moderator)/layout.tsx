// app/(moderator)/layout.tsx
// Role check is handled client-side by RoleGuard inside ModeratorLayoutClient.
// No session cookie required — uses Firebase client auth state.

import ModeratorLayoutClient from "./ModeratorLayoutClient"

export default function ModeratorLayout({ children }: { children: React.ReactNode }) {
  return <ModeratorLayoutClient>{children}</ModeratorLayoutClient>
}
