import { createFileRoute, Link } from '@tanstack/react-router'
import { Mail } from 'lucide-react'
import { useState } from 'react'
import { authClient } from '#/lib/auth-client'
import { AuthLayout } from '#/components/auth/auth-layout'
import { MarqueeBadge } from '#/components/auth/marquee-badge'
import { AuthCard } from '#/components/auth/auth-card'

export const Route = createFileRoute('/login')({
  component: LoginPage,
  head: () => ({
    meta: [{ title: 'Sign In — Popcorn' }],
  }),
})

function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      const { error: authError } = await authClient.signIn.magicLink({
        email,
        callbackURL: '/app',
      })
      if (authError) {
        setError(authError.message ?? 'Something went wrong')
      } else {
        setSent(true)
      }
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleResend() {
    setLoading(true)
    try {
      await authClient.signIn.magicLink({
        email,
        callbackURL: '/app',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <AuthLayout>
      <MarqueeBadge text={sent ? 'Check Your Inbox' : 'Welcome Back'} />

      <AuthCard>
        {sent ? (
          <div className="text-center">
            <div className="mx-auto mb-6 flex h-18 w-18 items-center justify-center rounded-full border-2 border-neon-cyan/30 shadow-[0_0_20px_rgba(0,229,255,0.15)]">
              <Mail className="h-8 w-8 text-neon-cyan/70" />
            </div>
            <h2 className="mb-2 font-display text-xl text-cream">
              Magic link sent!
            </h2>
            <p className="mb-6 text-sm text-cream/50">
              We sent a sign-in link to
              <br />
              <span className="text-neon-cyan">{email}</span>
            </p>
            <p className="mb-6 text-xs text-cream/30">
              Check your inbox and click the link to continue.
              <br />
              The link expires in 10 minutes.
            </p>
            <button
              type="button"
              onClick={handleResend}
              disabled={loading}
              className="text-sm text-cream/35 underline decoration-cream/15 transition-colors hover:text-cream/50 disabled:opacity-50"
            >
              Didn't get it? Resend
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <h2 className="mb-1.5 font-display text-xl text-cream">Sign In</h2>
            <p className="mb-6 text-sm text-cream/50">
              Enter your email and we'll send you a magic link
            </p>

            {error && (
              <p className="mb-4 rounded-lg border border-neon-pink/20 bg-neon-pink/5 px-4 py-2 text-sm text-neon-pink">
                {error}
              </p>
            )}

            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@email.com"
              className="mb-4 w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-pink/40 focus:outline-none"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-lg border-[1.5px] border-neon-pink/50 bg-neon-pink/8 py-3 font-display text-[15px] tracking-wide text-neon-pink shadow-[0_0_15px_rgba(255,45,120,0.12)] transition-all duration-300 hover:bg-neon-pink/15 hover:shadow-[0_0_25px_rgba(255,45,120,0.25)] disabled:opacity-50"
              style={{ textShadow: '0 0 10px rgba(255,45,120,0.3)' }}
            >
              {loading ? 'Sending...' : 'Send Magic Link'}
            </button>

            <div className="mt-5 border-t border-cream/8 pt-5">
              <Link
                to="/"
                className="text-sm text-cream/40 no-underline transition-colors hover:text-cream/60"
              >
                ← Back to home
              </Link>
            </div>
          </form>
        )}
      </AuthCard>
    </AuthLayout>
  )
}
