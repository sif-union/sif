import Dashboard from "@/components/Dashboard";
import { loadSiteData } from "@/lib/site-data";

// Runs at build time: the page ships with the numbers already computed.
export default function HomePage() {
  return <Dashboard data={loadSiteData()} />;
}
