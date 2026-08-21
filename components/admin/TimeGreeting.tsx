"use client";

import { useEffect, useState } from "react";

type TimeGreetingProps = {
  name?: string;
};

function getGreeting(hour: number) {
  if (hour >= 5 && hour < 12) return "Good morning";
  if (hour >= 12 && hour < 17) return "Good afternoon";
  return "Good evening";
}

export default function TimeGreeting({ name = "Limitless" }: TimeGreetingProps) {
  const [greeting, setGreeting] = useState("Welcome back");

  useEffect(() => {
    const updateGreeting = () => setGreeting(getGreeting(new Date().getHours()));
    updateGreeting();

    const interval = window.setInterval(updateGreeting, 60_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <span>
      {greeting}, {name}
    </span>
  );
}
