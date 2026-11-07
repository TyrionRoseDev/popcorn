import { Link, notFound } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { AuthLayout } from "#/components/auth/auth-layout";

export type Unavailable = "missing" | "private";

function trpcErrorCode(error: unknown): string | undefined {
	if (typeof error !== "object" || error === null) return undefined;
	if ("data" in error) {
		const data = (error as { data?: { code?: unknown } }).data;
		if (typeof data?.code === "string") return data.code;
	}
	if ("code" in error && typeof error.code === "string") return error.code;
	return undefined;
}

export async function orNotFound<T>(load: () => Promise<T>): Promise<T> {
	try {
		return await load();
	} catch (error) {
		const code = trpcErrorCode(error);
		if (code === "NOT_FOUND") throw notFound({ data: "missing" });
		if (code === "FORBIDDEN") throw notFound({ data: "private" });
		throw error;
	}
}

export function unavailableReason(data: unknown): Unavailable {
	return data === "private" ? "private" : "missing";
}

export const notFoundLinkClass =
	"px-5 py-2.5 rounded-md bg-neon-pink/10 border border-neon-pink/30 text-neon-pink font-mono-retro text-xs tracking-wider uppercase hover:bg-neon-pink/20 hover:border-neon-pink/50 transition-all no-underline";

export function NotFoundState({
	eyebrow = "404",
	title,
	message,
	children,
}: {
	eyebrow?: string;
	title: string;
	message: string;
	children: ReactNode;
}) {
	return (
		<div className="relative z-10 flex flex-col items-center justify-center min-h-96 px-4 text-center">
			<div className="font-mono-retro text-xs text-neon-amber uppercase tracking-widest mb-3 [text-shadow:0_0_10px_rgba(255,184,0,0.3)]">
				{eyebrow}
			</div>
			<h1 className="font-display text-2xl md:text-3xl text-cream mb-2">
				{title}
			</h1>
			<p className="text-cream/50 text-sm mb-6 max-w-sm">{message}</p>
			{children}
		</div>
	);
}

export function AppNotFound() {
	return (
		<NotFoundState
			title="Page not found"
			message="There's nothing showing on this screen. The link may be broken or the page may have moved."
		>
			<Link
				to="/app/search"
				search={{ q: "", type: "all", sort: "relevance", page: 1 }}
				className={notFoundLinkClass}
			>
				Back to Search
			</Link>
		</NotFoundState>
	);
}

export function RootNotFound() {
	return (
		<AuthLayout>
			<NotFoundState
				title="Page not found"
				message="There's nothing showing on this screen. The link may be broken or the page may have moved."
			>
				<Link to="/" className={notFoundLinkClass}>
					Back to home
				</Link>
			</NotFoundState>
		</AuthLayout>
	);
}
