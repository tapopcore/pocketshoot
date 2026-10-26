"use client";
import { use } from "react";
import { JobView } from "@/components/job-view";
import { Spinner } from "@/components/ui";
import { useMe } from "../../use-me";

export default function ShopifyJob({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { me } = useMe();
  if (!me) return <div className="grid min-h-[50vh] place-items-center"><Spinner className="size-6" /></div>;
  return <JobView jobId={id} surface="shopify" freeRemakes={me.policy.freeRemakes} />;
}
