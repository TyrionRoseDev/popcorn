export function FormError({ message }: { message: string }) {
  return (
    <p className="mb-4 rounded-lg border border-neon-pink/20 bg-neon-pink/5 px-4 py-2 text-sm text-neon-pink">
      {message}
    </p>
  )
}
