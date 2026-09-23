import Home from "../components/Home";
import { configured } from "../lib/supabase-server";
export const dynamic = "force-dynamic";
export default function Page() {
  return <Home configured={configured()} />;
}
