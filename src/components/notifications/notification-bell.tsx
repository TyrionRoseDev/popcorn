import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { useState } from "react";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "#/components/ui/popover";
import { useTRPC } from "#/integrations/trpc/react";
import { NotificationItem } from "./notification-item";

export function NotificationBell() {
	const [open, setOpen] = useState(false);
	const trpc = useTRPC();
	const queryClient = useQueryClient();

	const { data: unreadCount = 0 } = useQuery({
		...trpc.notification.getUnreadCount.queryOptions(),
		refetchInterval: 30000,
	});

	const { data: notifications = [], isLoading } = useQuery({
		...trpc.notification.getAll.queryOptions(),
		enabled: open,
	});

	const markAllAsRead = useMutation(
		trpc.notification.markAllAsRead.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(
					trpc.notification.getUnreadCount.queryFilter(),
				);
			},
		}),
	);

	const deleteAll = useMutation(
		trpc.notification.deleteAll.mutationOptions({
			onSuccess: () => {
				queryClient.invalidateQueries(trpc.notification.getAll.queryFilter());
				queryClient.invalidateQueries(
					trpc.notification.getUnreadCount.queryFilter(),
				);
			},
		}),
	);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					className="relative rounded-lg p-2 text-cream/50 transition-colors hover:bg-cream/5 hover:text-cream/80 data-[state=open]:text-neon-cyan"
				>
					<Bell className="h-5 w-5" />
					{unreadCount > 0 && (
						<span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-neon-pink px-1 text-[10px] font-bold text-white">
							{unreadCount > 9 ? "9+" : unreadCount}
						</span>
					)}
				</button>
			</PopoverTrigger>
			<PopoverContent
				align="end"
				className="w-80 border-cream/10 bg-drive-in-card p-0"
			>
				{/* Header */}
				<div className="flex items-center justify-between border-b border-cream/8 px-4 py-3">
					<span className="text-sm font-semibold text-cream">
						Notifications
					</span>
					{unreadCount > 0 && (
						<button
							type="button"
							onClick={() => markAllAsRead.mutate()}
							className="text-xs text-cream/40 transition-colors hover:text-cream/60"
						>
							Mark all read
						</button>
					)}
				</div>

				{/* List */}
				<div className="max-h-[400px] overflow-y-auto">
					{isLoading ? (
						<div className="flex items-center justify-center py-8">
							<span className="text-sm text-cream/30">Loading...</span>
						</div>
					) : notifications.length === 0 ? (
						<div className="flex items-center justify-center py-8">
							<span className="text-sm text-cream/30">No notifications</span>
						</div>
					) : (
						notifications.map((n) => (
							<NotificationItem key={n.id} notification={n} />
						))
					)}
				</div>

				{/* Footer */}
				{notifications.length > 0 && (
					<div className="border-t border-cream/8 py-2.5 text-center">
						<button
							type="button"
							onClick={() => deleteAll.mutate()}
							className="text-xs text-neon-pink/70 transition-colors hover:text-neon-pink"
						>
							Delete all notifications
						</button>
					</div>
				)}
			</PopoverContent>
		</Popover>
	);
}
