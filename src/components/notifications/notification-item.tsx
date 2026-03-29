import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { X } from "lucide-react";
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
			return { text: "sent you a friend request" };
		case "title_reviewed":
			return {
				text: `reviewed ${data.titleName || "a title"} you recommended`,
				link: data.tmdbId
					? `/app/title/${data.mediaType}/${data.tmdbId}`
					: undefined,
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

	const data = (n.data ?? {}) as Record<string, unknown>;
	const actorName = n.actorUsername ?? "Someone";
	const { text, link } = getNotificationMessage(n.type, data, actorName);
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
