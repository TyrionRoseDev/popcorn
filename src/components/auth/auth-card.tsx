export function AuthCard({ children }: { children: React.ReactNode }) {
	return (
		<div className="w-full sm:w-[400px] rounded-xl border border-drive-in-border bg-drive-in-card/80 px-8 py-10 backdrop-blur-xl">
			{children}
		</div>
	);
}
