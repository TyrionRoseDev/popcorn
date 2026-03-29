import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "#/integrations/trpc/react";
import type { OnboardingState } from "./types";

const MAX_BIO_LENGTH = 100;

interface Props {
	onNext: () => void;
	onboardingState?: OnboardingState;
	setOnboardingState?: (state: Partial<OnboardingState>) => void;
}

export function BioStep({ onNext, onboardingState, setOnboardingState }: Props) {
	const [bio, setBio] = useState(onboardingState?.bio ?? "");

	const trpc = useTRPC();

	const saveMutation = useMutation(
		trpc.tasteProfile.saveProfileExtras.mutationOptions({
			onSuccess: () => {
				onNext();
			},
			onError: (error) => {
				toast.error(error.message || "Failed to save. Please try again.");
			},
		}),
	);

	function handleFinish(bioValue: string | null) {
		saveMutation.mutate({
			favouriteFilmTmdbId: onboardingState?.favouriteFilmTmdbId ?? null,
			favouriteGenreId: onboardingState?.favouriteGenreId ?? null,
			bio: bioValue,
		});
	}

	function handleContinue() {
		const trimmed = bio.trim() || null;
		setOnboardingState?.({ bio: trimmed });
		handleFinish(trimmed);
	}

	function handleSkip() {
		setOnboardingState?.({ bio: null });
		handleFinish(null);
	}

	const remaining = MAX_BIO_LENGTH - bio.length;

	return (
		<div>
			<h2 className="mb-1.5 font-display text-xl text-cream">
				A short bio?
			</h2>
			<p className="mb-6 text-sm text-cream/50">
				Tell others what kind of viewer you are
			</p>

			<div className="relative mb-2">
				<textarea
					value={bio}
					onChange={(e) =>
						setBio(e.target.value.slice(0, MAX_BIO_LENGTH))
					}
					placeholder="horror enthusiast. no spoilers."
					rows={3}
					className="w-full resize-none rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none"
				/>
			</div>

			<p
				className={`mb-6 text-right text-xs ${
					remaining <= 10 ? "text-neon-amber" : "text-cream/30"
				}`}
			>
				{bio.length}/{MAX_BIO_LENGTH}
			</p>

			<button
				type="button"
				onClick={handleContinue}
				disabled={saveMutation.isPending}
				className="w-full rounded-lg border-[1.5px] border-neon-cyan/50 bg-neon-cyan/8 py-3 font-display text-[15px] tracking-wide text-neon-cyan shadow-[0_0_15px_rgba(0,229,255,0.12)] transition-all duration-300 hover:bg-neon-cyan/15 hover:shadow-[0_0_25px_rgba(0,229,255,0.25)] disabled:opacity-50"
				style={{ textShadow: "0 0 10px rgba(0,229,255,0.3)" }}
			>
				{saveMutation.isPending ? "Saving..." : "Finish"}
			</button>

			<button
				type="button"
				onClick={handleSkip}
				disabled={saveMutation.isPending}
				className="mt-3 block w-full text-sm text-cream/30 transition-colors hover:text-cream/50 disabled:opacity-50"
			>
				Skip for now
			</button>
		</div>
	);
}
