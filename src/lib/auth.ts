import { betterAuth } from 'better-auth'
import { magicLink } from 'better-auth/plugins'
import { drizzleAdapter } from 'better-auth/adapters/drizzle'
import { tanstackStartCookies } from 'better-auth/tanstack-start'
import { render } from '@react-email/render'
import { Resend } from 'resend'
import { db } from '#/db'
import { env } from '#/env'
import MagicLinkEmail from '#/emails/magic-link'

const resend = new Resend(env.RESEND_API_KEY)

export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: 'pg',
  }),
  user: {
    additionalFields: {
      username: {
        type: 'string',
        required: false,
        input: true,
      },
      avatarUrl: {
        type: 'string',
        required: false,
        input: true,
      },
      onboardingCompleted: {
        type: 'boolean',
        required: false,
        defaultValue: false,
        input: true,
      },
    },
  },
  plugins: [
    tanstackStartCookies(),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        const html = await render(MagicLinkEmail({ url }))
        const { error } = await resend.emails.send({
          from: env.RESEND_FROM_EMAIL,
          to: email,
          subject: 'Your Popcorn sign-in link',
          html,
        })
        if (error) {
          console.error('Failed to send magic link email:', error)
          throw new Error('Failed to send magic link email')
        }
      },
    }),
  ],
})
