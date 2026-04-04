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
	const inputRef = useRef<HTMLInputElement>(null);

	// Sync with URL when navigating back/forward
	useEffect(() => {
		setValue(initialValue);
	}, [initialValue]);

	// Autofocus on mount + when Search tab is clicked
	useEffect(() => {
		inputRef.current?.focus();
		const handler = () => inputRef.current?.focus();
		window.addEventListener("focus-search", handler);
		return () => window.removeEventListener("focus-search", handler);
	}, []);

	// Clean up debounce on unmount
	useEffect(() => {
		return () => {
			if (debounceRef.current) clearTimeout(debounceRef.current);
		};
	}, []);

	const searchSorts = [
		"relevance",
		"popularity",
		"rating",
		"newest",
		"oldest",
	] as const;
	type SearchSort = (typeof searchSorts)[number];
	function toSearchSort(s: string | undefined): SearchSort {
		return searchSorts.includes(s as SearchSort)
			? (s as SearchSort)
			: "relevance";
	}

	function doSearch(query: string) {
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
		navigate({
			to: "/app/search",
			search: (prev) => ({
				q: query,
				type: prev.type ?? "all",
				sort: toSearchSort(prev.sort),
				page: 1,
				genre: prev.genre,
				yearMin: prev.yearMin,
				yearMax: prev.yearMax,
				rating: prev.rating,
			}),
		});
	}

	function handleChange(newValue: string) {
		setValue(newValue);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			doSearch(newValue);
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

	function handleSubmit(e: React.FormEvent) {
		e.preventDefault();
		doSearch(value);
	}

	return (
		<form onSubmit={handleSubmit} className="relative">
			<input
				ref={inputRef}
				type="text"
				aria-label="Search movies and TV shows"
				value={value}
				onChange={(e) => handleChange(e.target.value)}
				placeholder="Search movies & TV shows..."
				className="w-full rounded-xl border border-cream/12 bg-cream/6 py-3 px-4 pr-20 text-[15px] text-cream placeholder:text-cream/30 outline-none transition-all duration-200 focus:border-neon-cyan/40 focus:shadow-[0_0_20px_rgba(0,229,255,0.1)]"
			/>
			<div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
				{value && (
					<button
						type="button"
						onClick={handleClear}
						className="rounded-full p-1 text-cream/40 hover:text-cream/70 transition-colors"
						aria-label="Clear search"
					>
						<X className="h-4 w-4" />
					</button>
				)}
				<button
					type="submit"
					className="rounded-lg bg-neon-cyan/15 p-1.5 text-neon-cyan transition-colors hover:bg-neon-cyan/25"
					aria-label="Search"
				>
					<Search className="h-4 w-4" />
				</button>
			</div>
		</form>
	);
}
