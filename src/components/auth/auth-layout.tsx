import { Link } from '@tanstack/react-router'

export function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-drive-in-bg px-4 py-20 text-cream/85">
      {/* Vignette */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.7) 100%)',
          zIndex: 1,
        }}
      />

      {/* Ambient glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 100% 50% at 50% 110%, rgba(255,45,120,0.06) 0%, transparent 70%)',
          zIndex: 1,
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex flex-col items-center">
        {/* Logo */}
        <Link to="/" className="mb-6 no-underline">
          <h1
            className="font-logo text-[clamp(2rem,8vw,3.5rem)] leading-none"
            style={{
              animationName: 'neon-cycle',
              animationDuration: '6s',
              animationTimingFunction: 'ease-in-out',
              animationIterationCount: 'infinite',
            }}
          >
            POPCORN
          </h1>
        </Link>

        {children}
      </div>
    </div>
  )
}
