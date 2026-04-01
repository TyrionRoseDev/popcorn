import { useMutation, useQuery } from "@tanstack/react-query";
import {
	createFileRoute,
	Link,
	Outlet,
	useRouterState,
} from "@tanstack/react-router";
import { ChevronRight, Loader2, Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { ChangeAvatarDialog } from "#/components/settings/change-avatar-dialog";
import { ChangeEmailDialog } from "#/components/settings/change-email-dialog";
import { ChangeUsernameDialog } from "#/components/settings/change-username-dialog";
import { DeleteAccountDialog } from "#/components/settings/delete-account-dialog";
import { EditBioDialog } from "#/components/settings/edit-bio-dialog";
import { EditFavouriteFilmDialog } from "#/components/settings/edit-favourite-film-dialog";
import { EditGenresDialog } from "#/components/settings/edit-genres-dialog";
import { useTRPC } from "#/integrations/trpc/react";
import { authClient } from "#/lib/auth-client";
import { getUnifiedGenreById } from "#/lib/genre-map";
import { getTmdbImageUrl } from "#/lib/tmdb";

export const Route = createFileRoute("/app/settings")({
	component: SettingsLayout,
	head: () => ({
		meta: [{ title: "Settings — Popcorn" }],
	}),
});

function SettingsLayout() {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	if (pathname !== "/app/settings") {
		return <Outlet />;
	}
	return <SettingsPage />;
}

function SettingsPage() {
	const { data: session } = authClient.useSession();
	const user = session?.user;
	const trpc = useTRPC();

	// Dialog states
	const [avatarOpen, setAvatarOpen] = useState(false);
	const [usernameOpen, setUsernameOpen] = useState(false);
	const [emailOpen, setEmailOpen] = useState(false);
	const [deleteOpen, setDeleteOpen] = useState(false);
	const [genresOpen, setGenresOpen] = useState(false);
	const [filmOpen, setFilmOpen] = useState(false);
	const [bioOpen, setBioOpen] = useState(false);

	// Fetch user genres
	const userGenres = useQuery(trpc.tasteProfile.getUserGenres.queryOptions());

	// Fetch favourite film details (for title + poster)
	const filmDetails = useQuery(
		trpc.title.details.queryOptions(
			{ mediaType: "movie", tmdbId: user?.favouriteFilmTmdbId ?? 0 },
			{ enabled: !!user?.favouriteFilmTmdbId },
		),
	);

	// Data export
	const exportData = useMutation(
		trpc.user.exportData.mutationOptions({
			onSuccess: (data) => {
				const json = JSON.stringify(data, null, 2);
				const blob = new Blob([json], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const a = document.createElement("a");
				a.href = url;
				a.download = `popcorn-export-${user?.username ?? "user"}-${new Date().toISOString().slice(0, 10)}.json`;
				a.click();
				URL.revokeObjectURL(url);
			},
		}),
	);

	if (!user) return null;

	const genreIds = userGenres.data ?? [];
	const genreNames = genreIds
		.map((id) => getUnifiedGenreById(id)?.name)
		.filter(Boolean);

	return (
		<div className="mx-auto max-w-lg px-4 py-10">
			<h1 className="mb-8 font-display text-2xl text-cream">Settings</h1>

			{/* Profile Summary */}
			<button
				type="button"
				onClick={() => setAvatarOpen(true)}
				className="mb-6 flex w-full items-center gap-3 rounded-xl border border-cream/[0.04] bg-cream/[0.02] px-4 py-3.5 text-left transition-colors hover:bg-cream/[0.04]"
			>
				<div className="relative">
					{user.avatarUrl ? (
						<img
							src={user.avatarUrl}
							alt=""
							className="h-12 w-12 rounded-full object-cover"
						/>
					) : (
						<div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-neon-pink to-neon-cyan">
							<span className="text-lg font-semibold text-white">
								{user.username?.charAt(0).toUpperCase() || "?"}
							</span>
						</div>
					)}
					<div className="absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-cream">
						<Pencil className="h-2.5 w-2.5 text-drive-in-bg" />
					</div>
				</div>
				<div className="min-w-0 flex-1">
					<div className="text-sm font-semibold text-cream">
						{user.username || "No username"}
					</div>
					<div className="text-xs text-cream/50">{user.email}</div>
				</div>
			</button>

			{/* Account Section */}
			<SectionLabel>Account</SectionLabel>
			<div className="mb-6 overflow-hidden rounded-xl border border-cream/[0.04] bg-cream/[0.02]">
				<SettingsRow onClick={() => setAvatarOpen(true)} last={false}>
					<span className="text-sm text-cream/60">Profile Picture</span>
					<div className="flex items-center gap-2">
						{user.avatarUrl ? (
							<img
								src={user.avatarUrl}
								alt=""
								className="h-6 w-6 rounded-full object-cover"
							/>
						) : (
							<div className="flex h-6 w-6 items-center justify-center rounded-full bg-cream/10">
								<span className="text-[10px] text-cream/40">
									{user.username?.charAt(0).toUpperCase() || "?"}
								</span>
							</div>
						)}
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
				</SettingsRow>
				<SettingsRow onClick={() => setUsernameOpen(true)} last={false}>
					<span className="text-sm text-cream/60">Username</span>
					<div className="flex items-center gap-2">
						<span className="max-w-[180px] truncate text-sm text-cream/40">
							{user.username || "Not set"}
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
				</SettingsRow>
				<SettingsRow onClick={() => setEmailOpen(true)} last>
					<span className="text-sm text-cream/60">Email</span>
					<div className="flex items-center gap-2">
						<span className="max-w-[180px] truncate text-sm text-cream/40">
							{user.email}
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
				</SettingsRow>
			</div>

			{/* Taste Profile Section */}
			<SectionLabel>Taste Profile</SectionLabel>
			<div className="mb-6 rounded-xl border border-cream/[0.04] bg-cream/[0.02] p-4">
				{/* Genres */}
				<button
					type="button"
					onClick={() => setGenresOpen(true)}
					className="mb-4 w-full text-left"
				>
					<div className="mb-1.5 flex items-center justify-between">
						<span className="text-[9px] font-semibold uppercase tracking-wider text-cream/30">
							Genres
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
					<div className="flex flex-wrap gap-1.5">
						{genreNames.length > 0 ? (
							genreNames.map((name) => (
								<span
									key={name}
									className="rounded-full bg-neon-cyan/10 px-2.5 py-1 text-[11px] font-medium text-neon-cyan"
								>
									{name}
								</span>
							))
						) : (
							<span className="text-sm text-cream/30">Not set</span>
						)}
					</div>
				</button>

				<div className="mb-4 border-t border-cream/[0.04]" />

				{/* Favourite Film */}
				<button
					type="button"
					onClick={() => setFilmOpen(true)}
					className="mb-4 w-full text-left"
				>
					<div className="mb-1.5 flex items-center justify-between">
						<span className="text-[9px] font-semibold uppercase tracking-wider text-cream/30">
							Favorite Film
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
					{filmDetails.data ? (
						<div className="flex items-center gap-2">
							{filmDetails.data.posterPath && (
								<img
									src={getTmdbImageUrl(filmDetails.data.posterPath, "w92")!}
									alt=""
									className="h-10 w-7 rounded object-cover"
								/>
							)}
							<span className="text-sm text-cream/70">
								{filmDetails.data.title}
							</span>
						</div>
					) : (
						<span className="text-sm text-cream/30">Not set</span>
					)}
				</button>

				<div className="mb-4 border-t border-cream/[0.04]" />

				{/* Bio */}
				<button
					type="button"
					onClick={() => setBioOpen(true)}
					className="w-full text-left"
				>
					<div className="mb-1.5 flex items-center justify-between">
						<span className="text-[9px] font-semibold uppercase tracking-wider text-cream/30">
							Bio
						</span>
						<Pencil className="h-3.5 w-3.5 text-cream/20" />
					</div>
					{user.bio ? (
						<p className="text-sm italic text-cream/50">"{user.bio}"</p>
					) : (
						<span className="text-sm text-cream/30">Not set</span>
					)}
				</button>
			</div>

			{/* Data & Privacy Section */}
			<SectionLabel>Data & Privacy</SectionLabel>
			<div className="mb-6 overflow-hidden rounded-xl border border-cream/[0.04] bg-cream/[0.02]">
				<SettingsRow onClick={() => exportData.mutate()} last={false}>
					<span className="text-sm text-cream/60">Export Data</span>
					{exportData.isPending ? (
						<Loader2 className="h-4 w-4 animate-spin text-neon-cyan/70" />
					) : (
						<span className="text-xs font-medium text-neon-cyan/70">
							Download
						</span>
					)}
				</SettingsRow>
				<SettingsRow onClick={() => {}} last asLink="/app/settings/blocked">
					<span className="text-sm text-cream/60">Blocked Users</span>
					<ChevronRight className="h-4 w-4 text-cream/20" />
				</SettingsRow>
			</div>

			{/* Danger Zone */}
			<SectionLabel className="text-neon-pink/30">Danger Zone</SectionLabel>
			<button
				type="button"
				onClick={() => setDeleteOpen(true)}
				className="flex w-full items-center gap-3 rounded-xl border border-neon-pink/15 bg-neon-pink/5 px-4 py-3.5 text-left text-sm text-neon-pink/70 transition-colors hover:bg-neon-pink/10 hover:text-neon-pink"
			>
				<Trash2 className="h-4 w-4" />
				Delete Account
			</button>

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
			<EditGenresDialog
				open={genresOpen}
				onOpenChange={setGenresOpen}
				currentGenreIds={genreIds}
			/>
			<EditFavouriteFilmDialog
				open={filmOpen}
				onOpenChange={setFilmOpen}
				currentTmdbId={user.favouriteFilmTmdbId}
				currentTitle={filmDetails.data?.title ?? null}
				currentPosterPath={filmDetails.data?.posterPath ?? null}
			/>
			<EditBioDialog
				open={bioOpen}
				onOpenChange={setBioOpen}
				currentBio={user.bio}
			/>
		</div>
	);
}

function SectionLabel({
	children,
	className = "",
}: {
	children: React.ReactNode;
	className?: string;
}) {
	return (
		<h2
			className={`mb-2 text-[9px] font-semibold uppercase tracking-wider text-cream/20 ${className}`}
		>
			{children}
		</h2>
	);
}

function SettingsRow({
	children,
	onClick,
	last,
	asLink,
}: {
	children: React.ReactNode;
	onClick: () => void;
	last: boolean;
	asLink?: string;
}) {
	const className = `flex w-full items-center justify-between px-4 py-3 text-left transition-colors hover:bg-cream/[0.03] ${
		!last ? "border-b border-cream/[0.04]" : ""
	}`;

	if (asLink) {
		return (
			<Link to={asLink} className={className}>
				{children}
			</Link>
		);
	}

	return (
		<button type="button" onClick={onClick} className={className}>
			{children}
		</button>
	);
}
