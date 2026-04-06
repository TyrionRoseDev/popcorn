import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
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

	const { data: achievementData } = useQuery(
		trpc.achievement.myAchievements.queryOptions(),
	);
	const earnedTotal = (achievementData?.earned.length ?? 0) + pendingIds.length;

	const celebrate = useCallback((ids: string[]) => {
		const validIds = ids.filter((id) => ACHIEVEMENTS_BY_ID.has(id));
		if (validIds.length === 0) return;

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
