export function TasteProfileStep({ onNext }: { onNext: () => void }) {
	return (
		<div className="py-8 text-center text-cream/50">
			<h2 className="mb-2 font-display text-xl text-cream">
				What do you love watching?
			</h2>
			<p className="text-sm">Taste profile coming soon</p>
			<button
				type="button"
				onClick={onNext}
				className="mt-4 rounded-lg border border-neon-cyan/50 bg-neon-cyan/8 px-6 py-2 text-neon-cyan"
			>
				Skip for now
			</button>
		</div>
	);
}
