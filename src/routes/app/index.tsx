import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/app/')({
  component: AppHome,
  head: () => ({
    meta: [{ title: 'Popcorn' }],
  }),
})

function AppHome() {
  const { user } = Route.useRouteContext()
  return (
    <div className="flex min-h-screen items-center justify-center bg-drive-in-bg text-cream">
      <div className="text-center">
        <h1 className="font-logo text-4xl text-neon-pink">POPCORN</h1>
        <p className="mt-4 text-cream/60">
          Welcome{user.username ? `, ${user.username}` : ''}! The app is coming
          soon.
        </p>
      </div>
    </div>
  )
}
