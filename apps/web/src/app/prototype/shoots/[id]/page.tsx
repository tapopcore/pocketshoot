import { Suspense } from "react";
import { ResultView } from "./result-view";

export default function PrototypeResult() {
  return <Suspense><ResultView /></Suspense>;
}
