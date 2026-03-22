export function AuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full max-w-[400px] rounded-xl border border-drive-in-border bg-drive-in-card/80 p-8 backdrop-blur-xl">
      {children}
    </div>
  )
}
