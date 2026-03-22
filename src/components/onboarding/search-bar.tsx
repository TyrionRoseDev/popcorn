import { Search, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

interface SearchBarProps {
	value: string;
	onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
	const [localValue, setLocalValue] = useState(value);
	const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

	useEffect(() => {
		setLocalValue(value);
	}, [value]);

	function handleChange(newValue: string) {
		setLocalValue(newValue);

		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}

		debounceRef.current = setTimeout(() => {
			onChange(newValue);
		}, 300);
	}

	function handleClear() {
		setLocalValue("");
		onChange("");
		if (debounceRef.current) {
			clearTimeout(debounceRef.current);
		}
	}

	return (
		<div className="relative">
			<Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-cream/30" />
			<input
				type="text"
				value={localValue}
				onChange={(e) => handleChange(e.target.value)}
				placeholder="Search for a movie or TV show..."
				className="w-full rounded-lg border border-cream/12 bg-cream/6 py-3 pl-10 pr-10 text-sm text-cream placeholder:text-cream/30 focus:border-neon-cyan/40 focus:outline-none"
			/>
			{localValue && (
				<button
					type="button"
					onClick={handleClear}
					className="absolute right-3 top-1/2 -translate-y-1/2 text-cream/30 hover:text-cream/60"
				>
					<X className="h-4 w-4" />
				</button>
			)}
		</div>
	);
}
