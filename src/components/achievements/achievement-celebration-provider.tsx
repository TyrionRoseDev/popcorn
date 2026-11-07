import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useRef,
	useState,
} from "react";
import { setOnNewAchievements } from "#/integrations/tanstack-query/root-provider";
import { useTRPC } from "#/integrations/trpc/react";
import { ACHIEVEMENTS_BY_ID } from "#/lib/achievements";
import { AchievementPopup } from "./achievement-popup";

interface AchievementCelebrationContextValue {
	celebrate: (ids: string[]) => void;
}

const AchievementCelebrationContext =
	createContext<AchievementCelebrationContextValue>({
		celebrate: () => {},
	});

export function useAchievementCelebration() {
	return useContext(AchievementCelebrationContext);
}

export function AchievementCelebrationProvider({
	children,
}: {
	children: React.ReactNode;
}) {
	const [pendingIds, setPendingIds] = useState<string[]>([]);
	const queryClient = useQueryClient();
	const trpc = useTRPC();

	const { data: achievementData } = useQuery({
		...trpc.achievement.myAchievements.queryOptions(),
		refetchInterval: 30_000,
	});
	const earnedTotal = (achievementData?.earned.length ?? 0) + pendingIds.length;

	// Tracks achievement IDs already seen this session so we never double-celebrate.
	// Populated on first fetch (baseline) and updated whenever we fire a celebration.
	const knownIdsRef = useRef<Set<string>>(new Set());
	const initializedRef = useRef(false);

	const celebrate = useCallback((ids: string[]) => {
		const validIds = ids.filter((id) => ACHIEVEMENTS_BY_ID.has(id));
		if (validIds.length === 0) return;

		for (const id of validIds) knownIdsRef.current.add(id);

		setPendingIds((prev) => {
			const existing = new Set(prev);
			const newIds = validIds.filter((id) => !existing.has(id));
			return newIds.length > 0 ? [...prev, ...newIds] : prev;
		});
	}, []);

	useEffect(() => {
		setOnNewAchievements(celebrate);
		return () => setOnNewAchievements(null);
	}, [celebrate]);

	// Detect achievements earned on the server (e.g. when a friend accepts a
	// request and both users earn "Plus One"). The mutation-side celebration
	// only runs for the accepting client, so the requester relies on this
	// polling loop to surface the popup.
	useEffect(() => {
		const earned = achievementData?.earned;
		if (!earned) return;

		const ids = earned
			.map((a) => a.id)
			.filter((id): id is string => typeof id === "string");

		if (!initializedRef.current) {
			initializedRef.current = true;
			for (const id of ids) knownIdsRef.current.add(id);
			return;
		}

		const fresh = ids.filter((id) => !knownIdsRef.current.has(id));
		if (fresh.length > 0) celebrate(fresh);
	}, [achievementData, celebrate]);

	const handleDismiss = useCallback(() => {
		setPendingIds([]);
		queryClient.invalidateQueries({
			queryKey: trpc.achievement.myAchievements.queryKey(),
		});
	}, [queryClient, trpc]);

	return (
		<AchievementCelebrationContext value={{ celebrate }}>
			{children}
			{pendingIds.length > 0 && (
				<AchievementPopup
					achievementIds={pendingIds}
					earnedTotal={earnedTotal}
					onDismiss={handleDismiss}
				/>
			)}
		</AchievementCelebrationContext>
	);
}
