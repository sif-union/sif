"use client";
// The whole page: the header plus the two tabs. The period applies to both tabs.
import { useState } from "react";
import type { Period } from "@/lib/performance";
import type { SiteData } from "@/lib/site-data";
import Header, { type View } from "./Header";
import HoldingsView from "./HoldingsView";
import { TooltipProvider } from "./Tooltip";

export default function Dashboard({ data }: { data: SiteData }) {
  const [period, setPeriod] = useState<Period>("1Y");
  const [view, setView] = useState<View>("holdings");

  return (
    <TooltipProvider>
      <Header data={data} period={period} onPeriod={setPeriod} view={view} onView={setView} />
      {/* Both tabs stay mounted and are only hidden, so each keeps its state (open sector, search) while you're on the other. */}
      <main className="page">
        <section hidden={view !== "holdings"}><HoldingsView data={data} period={period} active={view === "holdings"} /></section>
        <section hidden={view !== "contribution"}>Contribution view (block 10)</section>
      </main>
    </TooltipProvider>
  );
}
