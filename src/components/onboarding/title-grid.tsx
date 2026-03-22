import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";
import type { FeedItem } from "#/lib/feed-assembler";
import { TitleCard } from "./title-card";

interface TitleGridProps {
	items: FeedItem[];
	selectedTitles: Map<string, FeedItem>;
	onToggleTitle: (item: FeedItem) => void;
	maxTitles: number;
	hasNextPage: boolean;
	isFetchingNextPage: boolean;
	fetchNextPage: () => void;
	isLoading: boolean;
}

function titleKey(item: FeedItem) {
	return `${item.tmdbId}-${item.mediaType}`;
}

export function TitleGrid({
	items,
	selectedTitles,
	onToggleTitle,
	maxTitles,
	hasNextPage,
	isFetchingNextPage,
	fetchNextPage,
	isLoading,
}: TitleGridProps) {
	const sentinelRef = useRef<HTMLDivElement>(null);

	useEffect(() => {
		const sentinel = sentinelRef.current;
		if (!sentinel) return;

		const observer = new IntersectionObserver(
			(entries) => {
				if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
					fetchNextPage();
				}
			},
			{ rootMargin: "200px" },
		);

		observer.observe(sentinel);
		return () => observer.disconnect();
	}, [hasNextPage, isFetchingNextPage, fetchNextPage]);

	if (isLoading) {
		return (
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{["sk-0", "sk-1", "sk-2", "sk-3", "sk-4", "sk-5", "sk-6", "sk-7"].map(
					(skeletonKey) => (
						<div
							key={skeletonKey}
							className="animate-pulse rounded-xl border border-cream/8 bg-cream/[0.03]"
						>
							<div className="aspect-[4/5] bg-cream/5" />
							<div className="space-y-2 p-3">
								<div className="h-4 w-3/4 rounded bg-cream/5" />
								<div className="h-3 w-1/4 rounded bg-cream/5" />
								<div className="h-3 w-full rounded bg-cream/5" />
							</div>
						</div>
					),
				)}
			</div>
		);
	}

	if (items.length === 0) {
		return null;
	}

	const atMax = selectedTitles.size >= maxTitles;

	return (
		<>
			<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
				{items.map((item) => (
					<TitleCard
						key={titleKey(item)}
						item={item}
						isSelected={selectedTitles.has(titleKey(item))}
						onToggle={() => onToggleTitle(item)}
						selectionDisabled={atMax}
					/>
				))}
			</div>

			<div ref={sentinelRef} className="h-1" />

			{isFetchingNextPage && (
				<div className="flex justify-center py-6">
					<Loader2 className="h-6 w-6 animate-spin text-cream/30" />
				</div>
			)}
		</>
	);
}
