export function StepIndicator({
  steps,
  current,
}: {
  steps: number
  current: number
}) {
  return (
    <div className="mb-7 flex gap-2">
      {Array.from({ length: steps }, (_, i) => {
        const isDone = i < current
        const isActive = i === current
        return (
          <div
            key={i}
            className={[
              'h-[3px] w-8 rounded-sm',
              isDone
                ? 'bg-neon-cyan shadow-[0_0_6px_rgba(0,229,255,0.3)]'
                : isActive
                  ? 'bg-neon-pink shadow-[0_0_8px_rgba(255,45,120,0.4)]'
                  : 'bg-cream/12',
            ].join(' ')}
          />
        )
      })}
    </div>
  )
}
