export function TitlePageSkeleton() {
	return (
		<div>
			<div className="relative w-full h-[280px] md:h-[480px] animate-pulse bg-cream/5" />
			<div className="mx-auto max-w-[1400px] px-12 py-8 flex flex-col md:flex-row gap-9">
				<div className="flex flex-col items-center md:items-start gap-4 shrink-0">
					<div className="w-[160px] h-[240px] md:w-[220px] md:h-[330px] animate-pulse rounded-lg bg-cream/5" />
					<div className="w-[160px] md:w-[220px] h-11 animate-pulse rounded-md bg-cream/5" />
				</div>
				<div className="flex-1 min-w-0 space-y-6">
					<div className="space-y-2">
						<div className="h-10 w-2/3 animate-pulse rounded bg-cream/5" />
						<div className="h-4 w-1/3 animate-pulse rounded bg-cream/5" />
					</div>
					<div className="flex gap-2">
						<div className="h-7 w-16 animate-pulse rounded-full bg-cream/5" />
						<div className="h-7 w-16 animate-pulse rounded-full bg-cream/5" />
						<div className="h-7 w-16 animate-pulse rounded-full bg-cream/5" />
					</div>
					<div className="h-px bg-cream/5" />
					<div className="space-y-2">
						<div className="h-4 w-full animate-pulse rounded bg-cream/5" />
						<div className="h-4 w-5/6 animate-pulse rounded bg-cream/5" />
						<div className="h-4 w-4/6 animate-pulse rounded bg-cream/5" />
					</div>
					<div className="h-px bg-cream/5" />
					<div className="space-y-2">
						<div className="h-4 w-1/4 animate-pulse rounded bg-cream/5" />
						<div className="h-4 w-1/3 animate-pulse rounded bg-cream/5" />
					</div>
					<div className="h-px bg-cream/5" />
					<div className="flex gap-5 overflow-hidden">
						{Array.from({ length: 6 }, (_, i) => (
							<div
								// biome-ignore lint/suspicious/noArrayIndexKey: static skeleton placeholders
								key={i}
								className="flex flex-col items-center gap-2 min-w-[90px]"
							>
								<div className="w-[68px] h-[68px] rounded-full animate-pulse bg-cream/5" />
								<div className="h-3 w-16 animate-pulse rounded bg-cream/5" />
								<div className="h-2.5 w-14 animate-pulse rounded bg-cream/5" />
							</div>
						))}
					</div>
				</div>
			</div>
		</div>
	);
}
