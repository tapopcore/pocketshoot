import {notFound} from "next/navigation";
import {AppShell} from "@/components/app-shell";
import {BatchBuilder} from "@/app/app/batch/batch-builder";
export default function DevBatch(){if(process.env.PREVIEW_UI!=="1")notFound();return <AppShell locale="en" orgName="Demo workspace" orgs={[]} orgId="x" credits={100} email="demo@example.com" isPlatform={false}><BatchBuilder balance={100} creditsPerImage={2} creativeEnabled brandKits={[]} products={[{id:"11111111-1111-4111-8111-111111111111",name:"A long product name for a two-piece cap set with carry handles",category:"other",sku:null,coverUrl:"/showcase/style-demo-0.webp"},{id:"22222222-2222-4222-8222-222222222222",name:"Blue ballpoint pen",category:"other",sku:null,coverUrl:"/showcase/studio/diagonal.webp"}]}/></AppShell>;}
