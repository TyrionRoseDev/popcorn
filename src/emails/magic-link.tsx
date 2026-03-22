import {
  Html,
  Head,
  Preview,
  Body,
  Container,
  Heading,
  Text,
  Button,
  Hr,
  Tailwind,
  pixelBasedPreset,
} from '@react-email/components'

interface MagicLinkEmailProps {
  url: string
}

export default function MagicLinkEmail({ url }: MagicLinkEmailProps) {
  return (
    <Html lang="en">
      <Tailwind
        config={{
          presets: [pixelBasedPreset],
          theme: {
            extend: {
              colors: {
                'drive-in': '#050508',
                'drive-in-card': '#0a0a1e',
                'drive-in-border': '#1a1a2e',
                'neon-pink': '#FF2D78',
                'neon-cyan': '#00E5FF',
                'neon-amber': '#FFB800',
                cream: '#fffff0',
              },
            },
          },
        }}
      >
        <Head>
          <style>{`@import url('https://fonts.googleapis.com/css2?family=Manrope:wght@400;600;700&display=swap');`}</style>
        </Head>
        <Preview>Your Popcorn sign-in link</Preview>
        <Body
          className="bg-drive-in font-sans"
          style={{ fontFamily: "'Manrope', sans-serif" }}
        >
          <Container className="mx-auto max-w-xl px-5 py-10">
            {/* Logo */}
            <Heading
              className="text-center text-3xl font-bold text-neon-pink"
              style={{
                textShadow: '0 0 10px rgba(255,45,120,0.3)',
              }}
            >
              POPCORN
            </Heading>

            {/* Card */}
            <Container
              className="mx-auto mt-6 rounded-xl bg-drive-in-card px-8 py-8"
              style={{ border: '1px solid #1a1a2e' }}
            >
              <Heading className="mt-0 text-center text-xl font-bold text-cream">
                Your sign-in link
              </Heading>

              <Text className="text-center text-base text-cream/70">
                Click the button below to sign in to Popcorn. This link expires
                in 10 minutes.
              </Text>

              <Button
                href={url}
                className="mx-auto mt-4 block rounded-lg bg-neon-pink px-8 py-3 text-center text-base font-bold text-cream no-underline"
                style={{
                  boxShadow: '0 0 20px rgba(255,45,120,0.25)',
                }}
              >
                Sign In to Popcorn
              </Button>

              <Hr className="my-6 border-drive-in-border" />

              <Text className="text-center text-xs text-cream/40">
                If you didn't request this link, you can safely ignore this
                email.
              </Text>
            </Container>

            {/* Footer */}
            <Text className="mt-6 text-center text-xs text-cream/30">
              best enjoyed with popcorn.
            </Text>
          </Container>
        </Body>
      </Tailwind>
    </Html>
  )
}

MagicLinkEmail.PreviewProps = {
  url: 'http://localhost:3000/api/auth/magic-link/verify?token=abc123&callbackURL=/app',
} satisfies MagicLinkEmailProps
