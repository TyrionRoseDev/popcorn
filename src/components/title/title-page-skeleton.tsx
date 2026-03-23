export function TitlePageSkeleton() {
	return (
		<div>
			{/* Screen placeholder */}
			<div className="max-w-[1100px] mx-auto max-h-[450px] aspect-video rounded animate-pulse bg-cream/5" />

			{/* Car area spacer */}
			<div className="h-[90px]" />

			{/* Marquee placeholder */}
			<div className="max-w-[700px] mx-auto h-[100px] mt-[50px] rounded-lg animate-pulse bg-cream/5" />

			{/* Two-column content area */}
			<div className="max-w-[1060px] mx-auto mt-12 px-8 flex flex-col md:flex-row gap-12">
				{/* Left column */}
				<div className="w-full md:w-[280px]">
					{/* Poster placeholder */}
					<div className="aspect-[2/3] rounded-md animate-pulse bg-cream/5" />
					{/* Arcade buttons row */}
					<div className="mt-6 flex gap-4 justify-center">
						<div className="w-[72px] h-[72px] rounded-full animate-pulse bg-cream/5" />
						<div className="w-[72px] h-[72px] rounded-full animate-pulse bg-cream/5" />
						<div className="w-[72px] h-[72px] rounded-full animate-pulse bg-cream/5" />
					</div>
				</div>

				{/* Right column */}
				<div className="flex-1 space-y-7">
					{/* Synopsis card placeholder */}
					<div className="h-[200px] rounded-lg animate-pulse bg-cream/5" />
					{/* Details card placeholder */}
					<div className="h-[160px] rounded-lg animate-pulse bg-cream/5" />
					{/* Cast card placeholder */}
					<div className="h-[140px] rounded-lg animate-pulse bg-cream/5" />
				</div>
			</div>
		</div>
	);
}
