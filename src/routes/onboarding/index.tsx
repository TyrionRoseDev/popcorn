import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { generateReactHelpers } from "@uploadthing/react";
import { useState } from "react";
import { AuthLayout } from "#/components/auth/auth-layout";
import { FormError } from "#/components/auth/form-error";
import { MarqueeBadge } from "#/components/auth/marquee-badge";
import { StepIndicator } from "#/components/auth/step-indicator";
import { TasteProfileStep } from "#/components/onboarding/taste-profile-step";
import { authClient } from "#/lib/auth-client";
import type { UploadRouter } from "#/lib/uploadthing";

const { useUploadThing } = generateReactHelpers<UploadRouter>({
	url: "/api/uploadthing",
});

export const Route = createFileRoute("/onboarding/")({
	component: OnboardingPage,
	head: () => ({
		meta: [{ title: "Get Started — Popcorn" }],
	}),
});

// --- Step Registry ---

interface StepConfig {
	label: string;
	component: React.ComponentType<{
		onNext: () => void;
	}>;
}

const STEPS: StepConfig[] = [
	{ label: "Username", component: UsernameStep },
	{ label: "Avatar", component: AvatarStep },
	{ label: "Taste", component: TasteProfileStep },
];

function OnboardingPage() {
	const [currentStep, setCurrentStep] = useState(0);
	const [cardUnlocked, setCardUnlocked] = useState(false);
	const navigate = useNavigate();

	const StepComponent = STEPS[currentStep].component;
	const isFullWidthStep = currentStep === 2;

	function handleNext() {
		if (currentStep < STEPS.length - 1) {
			const nextStep = currentStep + 1;
			setCurrentStep(nextStep);
			if (nextStep === 2) {
				// Release height constraint after card transition finishes
				setTimeout(() => setCardUnlocked(true), 750);
			}
		} else {
			navigate({
				to: "/app/search",
				search: { q: "", type: "all", sort: "relevance", page: 1 },
			});
		}
	}

	return (
		<AuthLayout>
			<MarqueeBadge text="Setting Up" />
			<div
				className={`w-full rounded-xl border backdrop-blur-xl transition-all duration-700 ease-[cubic-bezier(0.4,0,0.2,1)] ${
					isFullWidthStep
						? "max-w-6xl border-transparent bg-transparent px-4 backdrop-blur-none"
						: "max-w-[400px] border-drive-in-border bg-drive-in-card/80 px-8 py-10"
				} ${isFullWidthStep && !cardUnlocked ? "overflow-hidden" : ""}`}
				style={{
					maxHeight: isFullWidthStep && !cardUnlocked ? "300px" : "none",
				}}
			>
				<StepIndicator steps={STEPS.length} current={currentStep} />
				<StepComponent onNext={handleNext} />
			</div>
		</AuthLayout>
	);
}

// --- Step 1: Username ---

function UsernameStep({ onNext }: { onNext: () => void }) {
	const [username, setUsername] = useState("");
	const [error, setError] = useState("");
	const [loading, setLoading] = useState(false);

	async function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		setError("");
		setLoading(true);

		try {
			const { error: updateError } = await authClient.updateUser({
				username,
			});
			if (updateError) {
				setError(updateError.message ?? "Username may be taken");
			} else {
				onNext();
			}
		} catch {
			setError("Something went wrong");
		} finally {
			setLoading(false);
		}
	}

	return (
		<form onSubmit={handleSubmit}>
			<h2 className="mb-1.5 font-display text-xl text-cream">
				Pick a username
			</h2>
			<p className="mb-6 text-sm text-cream/50">
				This is how others will find you
			</p>

			{error && <FormError message={error} />}

			<input
				type="text"
				required
				minLength={3}
				maxLength={24}
				pattern="^[a-zA-Z0-9_]+$"
				value={username}
				onChange={(e) => setUsername(e.target.value)}
				placeholder="cinephile42"
				className="mb-4 w-full rounded-lg border border-cream/12 bg-cream/6 px-3.5 py-3 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none"
			/>

			<button
				type="submit"
				disabled={loading || username.length < 3}
				className="w-full rounded-lg border-[1.5px] border-neon-cyan/50 bg-neon-cyan/8 py-3 font-display text-[15px] tracking-wide text-neon-cyan shadow-[0_0_15px_rgba(0,229,255,0.12)] transition-all duration-300 hover:bg-neon-cyan/15 hover:shadow-[0_0_25px_rgba(0,229,255,0.25)] disabled:opacity-50"
				style={{ textShadow: "0 0 10px rgba(0,229,255,0.3)" }}
			>
				{loading ? "Saving..." : "Continue"}
			</button>
		</form>
	);
}

// --- Step 2: Avatar ---

function AvatarStep({ onNext }: { onNext: () => void }) {
	const [preview, setPreview] = useState<string | null>(null);
	const [error, setError] = useState("");
	const [isSavingAvatar, setIsSavingAvatar] = useState(false);

	const { startUpload, isUploading } = useUploadThing("avatarUploader", {
		onClientUploadComplete: async (res) => {
			if (res?.[0]) {
				setIsSavingAvatar(true);
				try {
					const { error: updateError } = await authClient.updateUser({
						avatarUrl: res[0].ufsUrl,
					});
					if (updateError) {
						setError(updateError.message ?? "Failed to save avatar");
					}
				} finally {
					setIsSavingAvatar(false);
				}
			}
		},
		onUploadError: (err) => {
			setError(err.message);
		},
	});

	async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
		const file = e.target.files?.[0];
		if (!file) return;

		// Show preview
		const reader = new FileReader();
		reader.onloadend = () => setPreview(reader.result as string);
		reader.readAsDataURL(file);

		// Upload
		await startUpload([file]);
	}

	function handleContinue() {
		onNext();
	}

	return (
		<div className="text-center">
			<h2 className="mb-1.5 font-display text-xl text-cream">Add a photo</h2>
			<p className="mb-6 text-sm text-cream/50">
				Give your profile some personality
			</p>

			{error && <FormError message={error} />}

			<label className="group mx-auto mb-3 flex h-24 w-24 cursor-pointer flex-col items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-cream/20 transition-colors hover:border-neon-cyan/40">
				{preview ? (
					<img
						src={preview}
						alt="Avatar preview"
						className="h-full w-full object-cover"
					/>
				) : (
					<span className="text-2xl text-cream/30 group-hover:text-neon-cyan/60">
						+
					</span>
				)}
				<input
					type="file"
					accept="image/*"
					onChange={handleFileChange}
					className="hidden"
				/>
			</label>

			{(isUploading || isSavingAvatar) && (
				<p className="mb-4 text-xs text-neon-cyan/60">
					{isSavingAvatar ? "Saving..." : "Uploading..."}
				</p>
			)}

			<button
				type="button"
				onClick={handleContinue}
				disabled={isUploading || isSavingAvatar}
				className="w-full rounded-lg border-[1.5px] border-neon-cyan/50 bg-neon-cyan/8 py-3 font-display text-[15px] tracking-wide text-neon-cyan shadow-[0_0_15px_rgba(0,229,255,0.12)] transition-all duration-300 hover:bg-neon-cyan/15 hover:shadow-[0_0_25px_rgba(0,229,255,0.25)] disabled:opacity-50"
				style={{ textShadow: "0 0 10px rgba(0,229,255,0.3)" }}
			>
				Continue
			</button>

			<button
				type="button"
				onClick={handleContinue}
				disabled={isUploading || isSavingAvatar}
				className="mt-3 block w-full text-sm text-cream/30 transition-colors hover:text-cream/50 disabled:opacity-50"
			>
				Skip for now
			</button>
		</div>
	);
}
