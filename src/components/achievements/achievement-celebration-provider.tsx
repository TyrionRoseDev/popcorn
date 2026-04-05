import { useQueryClient } from "@tanstack/react-query";
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
	const [earnedTotal, setEarnedTotal] = useState(0);
	const queryClient = useQueryClient();
	const trpc = useTRPC();

	const celebrate = useCallback(
		(ids: string[]) => {
			const validIds = ids.filter((id) => ACHIEVEMENTS_BY_ID.has(id));
			if (validIds.length === 0) return;

			setPendingIds((prev) => [...prev, ...validIds]);

			// Estimate earned total from cache or use a reasonable fallback
			const cached = queryClient.getQueryData<{
				earned: unknown[];
				total: number;
			}>(trpc.achievement.myAchievements.queryKey());
			setEarnedTotal((cached?.earned.length ?? 0) + ids.length);
		},
		[queryClient, trpc],
	);

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
