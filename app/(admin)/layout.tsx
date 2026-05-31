// app/(admin)/layout.tsx
// Role check is handled client-side by RoleGuard inside AdminLayoutClient.
// No session cookie required — uses Firebase client auth state.

import AdminLayoutClient from "./AdminLayoutClient"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminLayoutClient>{children}</AdminLayoutClient>
}
