"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FormEvent, useEffect, useState } from "react";

export default function AdminSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");

  useEffect(() => {
    setQuery(searchParams.get("q") || "");
  }, [searchParams]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedQuery = query.trim();
    const targetPath = pathname.includes("/dashboard/limitless/leads")
      ? pathname
      : "/dashboard/limitless/leads";

    if (!trimmedQuery) {
      router.push(targetPath);
      return;
    }

    router.push(`${targetPath}?q=${encodeURIComponent(trimmedQuery)}`);
  }

  return (
    <form className="admin-search" onSubmit={submitSearch} role="search">
      <Search size={16} />
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search leads, phone, budget, location..."
        aria-label="Search leads"
      />
      <button type="submit">Search</button>
    </form>
  );
}
