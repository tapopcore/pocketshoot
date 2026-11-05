import Link from "next/link";
import { ChevronRight } from "lucide-react";

const GROUPS: { title: string; links: [string, string][] }[] = [
  { title: "Home", links: [["Returning user", "/prototype"], ["First run", "/prototype?state=empty"], ["Offline", "/prototype?offline=1"]] },
  { title: "Add your product", links: [["Empty", "/prototype/create"], ["Camera blocked", "/prototype/create?state=denied"], ["Upload fails", "/prototype/create?state=uploadError"]] },
  { title: "Is this right?", links: [["Checking the photo, then summary", "/prototype/create?step=understand"], ["Still checking", "/prototype/create?step=understand&state=analysing"]] },
  { title: "Choose your shoot", links: [["Choose a shoot", "/prototype/create?step=shoot"], ["Saved product", "/prototype/create?step=shoot&saved=1"]] },
  { title: "Ready to create", links: [["Smaller set than asked", "/prototype/create?step=review&state=smaller"], ["Prices changed", "/prototype/create?step=review&state=expired"], ["Not enough credits", "/prototype/create?step=review&state=insufficient"], ["Signed out", "/prototype/create?step=review&state=session"]] },
  { title: "Results", links: [["Just started", "/prototype/shoots/demo-job?fresh=1"], ["Mixed outcomes", "/prototype/shoots/demo-job"], ["Still running", "/prototype/shoots/demo-job?state=running"]] },
  { title: "Lists and account", links: [["Shoots", "/prototype/shoots"], ["Shoots loading", "/prototype/shoots?state=loading"], ["No shoots", "/prototype/shoots?state=empty"], ["Products", "/prototype/products"], ["No products", "/prototype/products?state=empty"], ["You and credits", "/prototype/you"]] },
];

export default function PrototypeStates() {
  return (
    <main className="pt-page">
      <div className="pt-stack-s"><h1>All screens</h1><p className="pt-small pt-muted">Every screen and state in this prototype. Each uses example data.</p></div>
      {GROUPS.map((g) => (
        <section key={g.title} className="pt-stack-s" aria-labelledby={`g-${g.title}`}>
          <h2 id={`g-${g.title}`} className="pt-label">{g.title}</h2>
          <div className="pt-index">{g.links.map(([t, h]) => <Link key={h} href={h}>{t}<ChevronRight size={18} aria-hidden /></Link>)}</div>
        </section>
      ))}
    </main>
  );
}
