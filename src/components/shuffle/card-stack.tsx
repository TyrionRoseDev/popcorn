import { useMutation, useQuery } from "@tanstack/react-query";
import { AnimatePresence } from "motion/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "#/integrations/trpc/react";
import type { FeedItem } from "#/lib/feed-assembler";
import { ActionButtons } from "./action-buttons";
import { CardDetailModal } from "./card-detail-modal";
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
	const [detailItem, setDetailItem] = useState<FeedItem | null>(null);

	// Pending button action — triggers stamp flash before card exits
	const [pendingAction, setPendingAction] = useState<"left" | "right" | null>(
		null,
	);

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
								watchlistName: result.watchlistName ?? "",
							});
						}
					},
				},
			);
		},
		[cards, watchlistId, recordSwipeMutation],
	);

	// Button press: set pending action to flash stamp, then swipe on completion
	const handleButtonSwipe = useCallback(
		(direction: "left" | "right") => {
			if (cards.length === 0 || pendingAction) return;
			setPendingAction(direction);
		},
		[cards.length, pendingAction],
	);

	const handleForceActionComplete = useCallback(() => {
		if (!pendingAction) return;
		handleSwipe(pendingAction);
		setPendingAction(null);
	}, [pendingAction, handleSwipe]);

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

	// --- Match toast polling for group sessions ---
	const seenMatchIds = useRef(new Set<string>());

	const { data: recentMatches } = useQuery({
		...trpc.shuffle.getRecentMatches.queryOptions({ watchlistId }),
		refetchInterval: 30000,
	});

	useEffect(() => {
		if (!recentMatches?.length) return;
		for (const item of recentMatches) {
			if (!seenMatchIds.current.has(item.id)) {
				seenMatchIds.current.add(item.id);
				toast.success("Your group matched a title!", {
					description: `A new pick was added to the watchlist.`,
				});
			}
		}
	}, [recentMatches]);

	const visibleCards = cards.slice(0, 3);

	return (
		<div className="flex w-full flex-col items-center gap-6">
			{/* Card area — larger, like a movie screen at a drive-in */}
			<div className="relative w-full max-w-[400px]">
				{/* Screen glow — light spill behind the card like a movie screen in the dark */}
				<div
					className="absolute -inset-6 -z-10"
					style={{
						background:
							"radial-gradient(ellipse at center, rgba(255,184,0,0.08) 0%, rgba(255,184,0,0.03) 40%, transparent 70%)",
						filter: "blur(20px)",
					}}
				/>

				{/* Subtle screen frame border */}
				<div
					className="absolute -inset-1 rounded-2xl"
					style={{
						border: "1px solid rgba(255,184,0,0.08)",
						borderRadius: "18px",
						boxShadow: "0 0 30px rgba(255,184,0,0.04)",
						pointerEvents: "none",
					}}
				/>

				{/* Card stack */}
				<div className="relative aspect-[2/3] w-full">
					<AnimatePresence>
						{visibleCards.map((card, index) => (
							<SwipeCard
								key={`${card.tmdbId}-${card.mediaType}`}
								item={card}
								onSwipe={handleSwipe}
								onTap={() => setDetailItem(cards[0])}
								isTop={index === 0}
								stackIndex={index}
								forceAction={index === 0 ? pendingAction : null}
								onForceActionComplete={
									index === 0 ? handleForceActionComplete : undefined
								}
							/>
						))}
					</AnimatePresence>

					{/* Empty state */}
					{cards.length === 0 && (
						<div
							className="flex h-full w-full items-center justify-center rounded-2xl border border-drive-in-border bg-drive-in-card"
							style={{
								boxShadow:
									"0 8px 40px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.03)",
							}}
						>
							<p className="px-8 text-center font-mono-retro text-xs text-cream/30">
								Loading your next picks...
							</p>
						</div>
					)}
				</div>
			</div>

			{/* Action buttons */}
			<ActionButtons
				onNo={() => handleButtonSwipe("left")}
				onYes={() => handleButtonSwipe("right")}
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

			{/* Card detail modal */}
			<CardDetailModal item={detailItem} onClose={() => setDetailItem(null)} />
		</div>
	);
}
