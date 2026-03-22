import { useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
	initialValue: string;
}

export function SearchBar({ initialValue }: SearchBarProps) {
	const [value, setValue] = useState(initialValue);
	const navigate = useNavigate();
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

	// Sync with URL when navigating back/forward
	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	function handleChange(newValue: string) {
		setValue(newValue);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			navigate({
				to: "/app/search",
				search: (prev) => ({ ...prev, q: newValue, page: 1 }),
			});
		}, 300);
	}

	function handleClear() {
		setValue("");
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		navigate({
			to: "/app/search",
			search: { q: "", type: "all", sort: "relevance", page: 1 },
		});
	}

	return (
		<div className="relative">
			<Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
			<input
				type="search"
				aria-label="Search movies and TV shows"
				value={value}
				onChange={(e) => handleChange(e.target.value)}
				placeholder="Search movies & TV shows..."
				className="w-full rounded-xl border border-cream/12 bg-cream/6 py-3 pl-10 pr-10 text-[15px] text-cream placeholder:text-cream/30 outline-none transition-all duration-200 focus:border-neon-cyan/40 focus:shadow-[0_0_20px_rgba(0,229,255,0.1)]"
			/>
			{value && (
				<button
					type="button"
					onClick={handleClear}
					className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-0.5 text-cream/40 hover:text-cream/70 transition-colors"
					aria-label="Clear search"
				>
					<X className="h-4 w-4" />
				</button>
			)}
		</div>
	);
}
