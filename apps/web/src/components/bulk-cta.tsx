/* eslint-disable @next/next/no-img-element -- static demo photos */
import Link from "next/link";
import { ArrowRight } from "lucide-react";

/** A small banner that opens Bulk shoots. Shown on Home, Products, My shoots and the first create step. */
export function BulkCta({ compact = false }: { compact?: boolean }) {
  return (
    <Link href="/app/batch" className={"bulkcta" + (compact ? " compact" : "")}>
      <span className="bc-st" aria-hidden>
        {["/showcase/studio/front.webp", "/showcase/style-demo-4.webp", "/showcase/style-demo-2.webp"].map((s) => <img key={s} src={s} alt="" loading="lazy" />)}
      </span>
      <span className="bc-t"><b>Bulk shoot</b><span>Many products at once, one look or a pack</span></span>
      <span className="bc-go"><em>Start bulk shoot</em><ArrowRight size={16} /></span>
    </Link>
  );
}
