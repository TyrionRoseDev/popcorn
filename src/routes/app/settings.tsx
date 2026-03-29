import { createFileRoute } from "@tanstack/react-router";
import { Camera, ChevronRight, Mail, Trash2, User } from "lucide-react";
import { useState } from "react";
import { ChangeAvatarDialog } from "#/components/settings/change-avatar-dialog";
import { ChangeEmailDialog } from "#/components/settings/change-email-dialog";
import { ChangeUsernameDialog } from "#/components/settings/change-username-dialog";
import { DeleteAccountDialog } from "#/components/settings/delete-account-dialog";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/app/settings")({
	component: SettingsPage,
	head: () => ({
		meta: [{ title: "Settings — Popcorn" }],
	}),
});

function SettingsPage() {
	const { data: session } = authClient.useSession();
	const user = session?.user;

	const [avatarOpen, setAvatarOpen] = useState(false);
	const [usernameOpen, setUsernameOpen] = useState(false);
	const [emailOpen, setEmailOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);

	if (!user) return null;

	return (
		<div className="mx-auto max-w-lg px-4 py-10">
			<h1 className="mb-8 font-display text-2xl text-cream">Settings</h1>

			<div className="overflow-hidden rounded-xl border border-cream/8 bg-drive-in-card">
				{/* Profile Picture */}
				<button
					type="button"
					onClick={() => setAvatarOpen(true)}
					className="flex w-full items-center gap-4 border-b border-cream/8 px-4 py-3.5 text-left transition-colors hover:bg-cream/4"
				>
					<Camera className="h-4 w-4 shrink-0 text-cream/40" />
					<div className="flex flex-1 items-center gap-3 min-w-0">
						<span className="text-sm text-cream/60">Profile Picture</span>
						<div className="ml-auto flex items-center gap-2">
							{user.avatarUrl ? (
								<img
									src={user.avatarUrl}
									alt=""
									className="h-7 w-7 rounded-full object-cover"
								/>
							) : (
								<div className="flex h-7 w-7 items-center justify-center rounded-full bg-cream/10">
									<span className="text-xs text-cream/40">
										{user.username?.charAt(0).toUpperCase() || "?"}
									</span>
								</div>
							)}
							<ChevronRight className="h-4 w-4 text-cream/20" />
						</div>
					</div>
				</button>

				{/* Username */}
				<button
					type="button"
					onClick={() => setUsernameOpen(true)}
					className="flex w-full items-center gap-4 border-b border-cream/8 px-4 py-3.5 text-left transition-colors hover:bg-cream/4"
				>
					<User className="h-4 w-4 shrink-0 text-cream/40" />
					<div className="flex flex-1 items-center justify-between min-w-0">
						<span className="text-sm text-cream/60">Username</span>
						<div className="flex items-center gap-2">
							<span className="text-sm text-cream/40 truncate max-w-[200px]">
								{user.username || "Not set"}
							</span>
							<ChevronRight className="h-4 w-4 text-cream/20" />
						</div>
					</div>
				</button>

				{/* Email */}
				<button
					type="button"
					onClick={() => setEmailOpen(true)}
					className="flex w-full items-center gap-4 px-4 py-3.5 text-left transition-colors hover:bg-cream/4"
				>
					<Mail className="h-4 w-4 shrink-0 text-cream/40" />
					<div className="flex flex-1 items-center justify-between min-w-0">
						<span className="text-sm text-cream/60">Email</span>
						<div className="flex items-center gap-2">
							<span className="text-sm text-cream/40 truncate max-w-[200px]">
								{user.email}
							</span>
							<ChevronRight className="h-4 w-4 text-cream/20" />
						</div>
					</div>
				</button>
			</div>

			{/* Danger Zone */}
			<div className="mt-8">
				<h2 className="mb-3 text-xs font-medium uppercase tracking-wider text-cream/30">
					Danger Zone
				</h2>
				<button
					type="button"
					onClick={() => setDeleteOpen(true)}
					className="flex w-full items-center gap-3 rounded-xl border border-neon-pink/15 bg-neon-pink/5 px-4 py-3.5 text-left text-sm text-neon-pink/70 transition-colors hover:bg-neon-pink/10 hover:text-neon-pink"
				>
					<Trash2 className="h-4 w-4" />
					Delete Account
				</button>
			</div>

			{/* Dialogs */}
			<ChangeAvatarDialog
				open={avatarOpen}
				onOpenChange={setAvatarOpen}
				currentAvatarUrl={user.avatarUrl}
				fallbackInitial={user.username?.charAt(0).toUpperCase() || "?"}
			/>
			<ChangeUsernameDialog
				open={usernameOpen}
				onOpenChange={setUsernameOpen}
				currentUsername={user.username}
			/>
			<ChangeEmailDialog
				open={emailOpen}
				onOpenChange={setEmailOpen}
				currentEmail={user.email}
			/>
			<DeleteAccountDialog open={deleteOpen} onOpenChange={setDeleteOpen} />
		</div>
	);
}
