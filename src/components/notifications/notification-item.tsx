import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "#/integrations/trpc/react";

interface NotificationItemProps {
	notification: {
		id: string;
		type: string;
		data: unknown;
		read: boolean;
		actionTaken: string | null;
		createdAt: Date;
		actorId: string | null;
		actorUsername: string | null;
		actorAvatarUrl: string | null;
	};
}

function formatTimeAgo(date: Date): string {
	const now = new Date();
	const diffMs = now.getTime() - new Date(date).getTime();
	const diffMin = Math.floor(diffMs / 60000);
	const diffHr = Math.floor(diffMs / 3600000);
	const diffDay = Math.floor(diffMs / 86400000);

	if (diffMin < 1) return "Just now";
	if (diffMin < 60) return `${diffMin}m ago`;
	if (diffHr < 24) return `${diffHr}h ago`;
	if (diffDay === 1) return "Yesterday";
	return `${diffDay}d ago`;
}

function getNotificationMessage(
	type: string,
	data: Record<string, unknown>,
	_actorName: string,
	actorId: string | null,
): { text: string; link?: string } {
	switch (type) {
		case "watchlist_item_added":
			return {
				text: `added ${data.titleName || "a title"} to ${data.watchlistName}`,
				link: `/app/watchlists/${data.watchlistId}`,
			};
		case "watchlist_member_joined":
			return {
				text: `joined ${data.watchlistName}`,
				link: `/app/watchlists/${data.watchlistId}`,
			};
		case "shuffle_match":
			return {
				text: `Everyone wants to watch ${data.titleName || "a title"}!`,
				link: data.tmdbId
					? `/app/title/${data.mediaType}/${data.tmdbId}`
					: undefined,
			};
		case "item_watched":
			return {
				text: `marked ${data.titleName || "a title"} as watched in ${data.watchlistName}`,
				link: `/app/watchlists/${data.watchlistId}`,
			};
		case "watchlist_invite":
			return {
				text: `invited you to ${data.watchlistName}`,
				link: `/app/watchlists/${data.watchlistId}`,
			};
		case "friend_request":
			return {
				text: "sent you a friend request",
				link: actorId ? `/app/profile/${actorId}` : "/app/friends",
			};
		case "friend_request_accepted":
			return {
				text: "accepted your friend request",
				link: actorId ? `/app/profile/${actorId}` : undefined,
			};
		case "title_reviewed":
			return {
				text: `reviewed ${data.titleName || "a title"} you recommended`,
				link: data.tmdbId
					? `/app/title/${data.mediaType}/${data.tmdbId}`
					: undefined,
			};
		case "recommendation_received":
			return {
				text: `recommended ${data.titleName || "a title"} for you${data.message ? ` — "${data.message}"` : ""}`,
				link: data.tmdbId
					? `/app/title/${data.mediaType}/${data.tmdbId}`
					: undefined,
			};
		case "recommendation_reviewed":
			return {
				text: `reviewed ${data.titleName || "a title"} you recommended`,
				link: data.tmdbId
					? `/app/title/${data.mediaType}/${data.tmdbId}`
					: undefined,
			};
		case "recommendation_watched":
			return {
				text: `watched ${data.titleName || "a title"} that you recommended`,
				link: data.tmdbId
					? `/app/title/${data.mediaType}/${data.tmdbId}`
					: undefined,
			};
		case "review_reminder":
			return {
				text: `How was ${data.titleName || "a title"}? Leave a quick review`,
				link: `/app/title/${data.mediaType}/${data.tmdbId}?reviewReminder=${data.watchEventId}`,
			};
		default:
			return { text: "sent you a notification" };
	}
}

export function NotificationItem({ notification: n }: NotificationItemProps) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const markAsRead = useMutation(
		trpc.notification.markAsRead.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(
					trpc.notification.getUnreadCount.queryFilter(),
				);
			},
		}),
	);

	const deleteNotification = useMutation(
		trpc.notification.delete.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(
					trpc.notification.getUnreadCount.queryFilter(),
				);
			},
		}),
	);

	const acceptRecommendation = useMutation(
		trpc.recommendation.accept.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(
					trpc.notification.getUnreadCount.queryFilter(),
				);
				queryClient.invalidateQueries(trpc.watchlist.list.queryFilter());
			},
			onError: () => {
				toast.error("Failed to accept recommendation");
			},
		}),
	);

	const declineRecommendation = useMutation(
		trpc.recommendation.decline.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(
					trpc.notification.getUnreadCount.queryFilter(),
				);
			},
			onError: () => {
				toast.error("Failed to decline recommendation");
			},
		}),
	);

	const data = (n.data ?? {}) as Record<string, unknown>;
	const actorName = n.actorUsername ?? "Someone";
	const { text, link } = getNotificationMessage(
		n.type,
		data,
		actorName,
		n.actorId,
	);
	const isMatch = n.type === "shuffle_match";

	const content = (
		<div
			className={`flex gap-2.5 px-4 py-3 ${
				n.read
					? "border-l-2 border-l-transparent"
					: "border-l-2 border-l-neon-cyan bg-neon-cyan/[0.04]"
			}`}
		>
			{/* Avatar */}
			<div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-cream/10">
				{isMatch ? (
					<span className="text-sm">🎉</span>
				) : n.actorAvatarUrl ? (
					<img
						src={n.actorAvatarUrl}
						alt=""
						className="h-8 w-8 rounded-full object-cover"
					/>
				) : (
					<span className="text-xs font-medium text-cream/60">
						{actorName.charAt(0).toUpperCase()}
					</span>
				)}
			</div>

			{/* Content */}
			<div className="min-w-0 flex-1">
				<p
					className={`text-[13px] leading-snug ${n.read ? "text-cream/50" : "text-cream/90"}`}
				>
					{isMatch ? (
						text
					) : (
						<>
							<strong className={n.read ? "text-cream/60" : "text-cream"}>
								{actorName}
							</strong>{" "}
							{text}
						</>
					)}
				</p>
				<span
					className={`text-[11px] ${n.read ? "text-cream/25" : "text-cream/35"}`}
				>
					{formatTimeAgo(n.createdAt)}
				</span>
				{n.type === "recommendation_received" &&
					!n.actionTaken &&
					n.actorId && (
						<div className="mt-1.5 flex items-center gap-2">
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									acceptRecommendation.mutate({
										notificationId: n.id,
										tmdbId: data.tmdbId as number,
										mediaType: data.mediaType as "movie" | "tv",
										recommendedBy: n.actorId as string,
										message: (data.message as string) ?? null,
									});
								}}
								disabled={acceptRecommendation.isPending}
								className="inline-flex items-center gap-1 rounded-full border border-neon-cyan/30 bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-semibold text-neon-cyan transition-colors hover:bg-neon-cyan/20 disabled:opacity-50"
							>
								<Check className="h-3 w-3" />
								Accept
							</button>
							<button
								type="button"
								onClick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									declineRecommendation.mutate({
										notificationId: n.id,
									});
								}}
								disabled={declineRecommendation.isPending}
								className="rounded-full border border-cream/15 px-2.5 py-1 text-[11px] text-cream/40 transition-colors hover:text-cream/60 hover:border-cream/25 disabled:opacity-50"
							>
								Decline
							</button>
						</div>
					)}
				{n.type === "recommendation_received" &&
					n.actionTaken === "accepted" && (
						<span className="mt-1 inline-block text-[10px] text-neon-cyan/60">
							Added to your Recommendations
						</span>
					)}
				{n.type === "recommendation_received" &&
					n.actionTaken === "declined" && (
						<span className="mt-1 inline-block text-[10px] text-cream/25">
							Declined
						</span>
					)}
			</div>

			{/* Dismiss */}
			<button
				type="button"
				onClick={(e) => {
					e.preventDefault();
					e.stopPropagation();
					deleteNotification.mutate({ id: n.id });
				}}
				className="flex-shrink-0 p-0.5 text-cream/20 transition-colors hover:text-cream/50"
			>
				<X className="h-3.5 w-3.5" />
			</button>
		</div>
	);

	if (link) {
		return (
			<Link
				to={link as string}
				className="block no-underline transition-colors hover:bg-cream/[0.03]"
				onClick={() => {
					if (!n.read) markAsRead.mutate({ id: n.id });
				}}
			>
				{content}
			</Link>
		);
	}

	return (
		<button
			type="button"
			className="w-full text-left transition-colors hover:bg-cream/[0.03]"
			onClick={() => {
				if (!n.read) markAsRead.mutate({ id: n.id });
			}}
		>
			{content}
		</button>
	);
}
