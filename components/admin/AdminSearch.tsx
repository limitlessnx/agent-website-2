"use client";

import { Search } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function AdminSearch() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    router.push(trimmedQuery ? `/dashboard/search?q=${encodeURIComponent(trimmedQuery)}` : "/dashboard/search");
  }

  return (
    <form className="admin-search" onSubmit={submitSearch} role="search">
      <Search size={16} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search organizations, leads, properties, agents and workflows..."
        aria-label="Global platform search"
      />
      <button type="submit">Search</button>
    </form>
  );
}
