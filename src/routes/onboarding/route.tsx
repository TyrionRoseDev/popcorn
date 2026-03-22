import { createFileRoute, redirect, Outlet } from '@tanstack/react-router'
import { getSession } from '#/lib/auth-session'

export const Route = createFileRoute('/onboarding')({
  beforeLoad: async () => {
    const session = await getSession()

    if (!session?.user) {
      throw redirect({ to: '/login' })
    }

    if (session.user.onboardingCompleted) {
      throw redirect({ to: '/app' })
    }

    return { user: session.user }
  },
  component: () => <Outlet />,
})
