import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useState } from "react";
import { useTRPC } from "#/integrations/trpc/react";
import type { FeedItem } from "#/lib/feed-assembler";
import { ActionButtons } from "./action-buttons";
import { MatchCelebration } from "./match-celebration";
import { SwipeCard } from "./swipe-card";

interface CardStackProps {
	watchlistId: string;
}

export function CardStack({ watchlistId }: CardStackProps) {
	const trpc = useTRPC();

	const [cursor, setCursor] = useState<string | undefined>(undefined);
	const [cards, setCards] = useState<FeedItem[]>([]);
	const [lastSwiped, setLastSwiped] = useState<{
		item: FeedItem;
		action: string;
	} | null>(null);
	const [matchData, setMatchData] = useState<{
		title: string;
		posterPath: string | null;
		watchlistName: string;
	} | null>(null);

	const { data: feedData } = useQuery({
		...trpc.shuffle.getFeed.queryOptions({
			watchlistId,
			cursor,
		}),
		enabled: cards.length < 5,
	});

	// Merge new items into cards when data arrives
	useEffect(() => {
		if (!feedData?.items.length) return;

		setCards((prev) => {
			const existingKeys = new Set(
				prev.map((c) => `${c.tmdbId}-${c.mediaType}`),
			);
			const newItems = feedData.items.filter(
				(item) => !existingKeys.has(`${item.tmdbId}-${item.mediaType}`),
			);
			if (newItems.length === 0) return prev;
			return [...prev, ...newItems];
		});

		if (feedData.nextCursor) {
			setCursor(feedData.nextCursor);
		}
	}, [feedData]);

	const recordSwipeMutation = useMutation(
		trpc.shuffle.recordSwipe.mutationOptions(),
	);

	const undoSwipeMutation = useMutation(
		trpc.shuffle.undoSwipe.mutationOptions(),
	);

	const handleSwipe = useCallback(
		(direction: "left" | "right") => {
			if (cards.length === 0) return;
			const topCard = cards[0];
			const action = direction === "right" ? "yes" : "no";

			setCards((prev) => prev.slice(1));
			setLastSwiped({ item: topCard, action });

			recordSwipeMutation.mutate(
				{
					watchlistId,
					tmdbId: topCard.tmdbId,
					mediaType: topCard.mediaType,
					action,
				},
				{
					onSuccess: (result) => {
						if (result.match) {
							setMatchData({
								title: topCard.title,
								posterPath: topCard.posterPath,
								watchlistName: "Shuffle Picks",
							});
						}
					},
				},
			);
		},
		[cards, watchlistId, recordSwipeMutation],
	);

	const handleHide = useCallback(() => {
		if (cards.length === 0) return;
		const topCard = cards[0];

		setCards((prev) => prev.slice(1));
		setLastSwiped({ item: topCard, action: "hide" });

		recordSwipeMutation.mutate({
			watchlistId,
			tmdbId: topCard.tmdbId,
			mediaType: topCard.mediaType,
			action: "hide",
		});
	}, [cards, watchlistId, recordSwipeMutation]);

	const handleUndo = useCallback(() => {
		if (!lastSwiped) return;
		const { item } = lastSwiped;

		setCards((prev) => [item, ...prev]);
		setLastSwiped(null);

		undoSwipeMutation.mutate({
			watchlistId,
			tmdbId: item.tmdbId,
			mediaType: item.mediaType,
		});
	}, [lastSwiped, watchlistId, undoSwipeMutation]);

	const visibleCards = cards.slice(0, 3);

	return (
		<div className="flex flex-col items-center gap-6">
			{/* Card stack area */}
			<div className="relative h-[420px] w-[300px]">
				<AnimatePresence>
					{visibleCards.map((card, index) => (
						<SwipeCard
							key={`${card.tmdbId}-${card.mediaType}`}
							item={card}
							onSwipe={handleSwipe}
							onTap={() => {}}
							isTop={index === 0}
							stackIndex={index}
						/>
					))}
				</AnimatePresence>

				{/* Empty state */}
				{cards.length === 0 && (
					<div className="flex h-full w-full items-center justify-center rounded-2xl border border-cream/10 bg-drive-in-card">
						<p className="px-8 text-center font-mono-retro text-xs text-cream/30">
							Loading your next picks...
						</p>
					</div>
				)}
			</div>

			{/* Action buttons */}
			<ActionButtons
				onNo={() => handleSwipe("left")}
				onYes={() => handleSwipe("right")}
				onUndo={handleUndo}
				onHide={handleHide}
				canUndo={lastSwiped !== null}
			/>

			{/* Match celebration overlay */}
			<MatchCelebration
				isOpen={matchData !== null}
				onClose={() => setMatchData(null)}
				title={matchData?.title ?? ""}
				posterPath={matchData?.posterPath ?? null}
				watchlistName={matchData?.watchlistName ?? ""}
			/>
		</div>
	);
}
