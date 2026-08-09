import { redirect } from "next/navigation";

// This app does one job: tally client info — the tally dashboard IS the app.
// The legacy case-review screens still exist at /cases and /banks but are
// intentionally not linked anywhere.
export default function Home() {
  redirect("/tally");
}
