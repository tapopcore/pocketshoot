"use client";
import {ReferenceViewer} from "@/components/reference-viewer";
import {shrinkPhoto} from "@/lib/photo-client";
import { FitImg } from "@/components/fit-img";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Camera, ImagePlus, Trash } from "lucide-react";
import { CATEGORY_LIST, LOCKS, type LockId } from "@packshot/core";
import { api, toast, uploadFiles } from "@/lib/client";
import { Button, Field, Input, Select, Spinner, Textarea } from "@/components/ui";

export function ProductEditor({ product, photos }: {
  product: { id: string; name: string; category: string; sku: string | null; locks: string[]; mustNotChange: string | null; archived: boolean };
  photos: { id: string; url: string | null; view: string; size: string; cutout: string | null }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name: product.name, category: product.category, sku: product.sku ?? "", locks: product.locks ?? [], mustNotChange: product.mustNotChange ?? "" });
  const [busy, setBusy] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null), camera=useRef<HTMLInputElement>(null);
  const [photoOpen,setPhotoOpen]=useState<number|null>(null);
  const viewLabels:Record<string,string>={front:"Front",angle:"Angled",side:"Side",back:"Back",detail:"Close-up",other:"Other"};
  const [view, setView] = useState("angle");

  async function save(extra: Record<string, unknown> = {}) {
    setBusy("save");
    try {
      await api(`/api/products/${product.id}`, { method: "PATCH", json: { ...form, sku: form.sku || null, mustNotChange: form.mustNotChange || null, ...extra } });
      toast("Saved");
      router.refresh();
    } catch (e) { toast((e as Error).message, true); }
    setBusy(null);
  }

  async function addPhotos(files: FileList | null) {
    if (!files?.length || busy || photos.length>=6) return;
    setBusy("upload");
    try {
      const keys = await uploadFiles(await Promise.all(Array.from(files).slice(0, Math.max(0, 6 - photos.length)).map(shrinkPhoto)));
      await api(`/api/products/${product.id}/photos`, { method: "POST", json: { uploads: keys.map((k) => ({ key: k, viewType: view })) } });
      router.refresh();
    } catch (e) { toast((e as Error).message, true); }
    setBusy(null);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <div className="pe-head"><h2 className="h5">Product photos <span className="sm muted" style={{ fontWeight: 400 }}>· {photos.length} of 6</span></h2>{photos.length < 6 && <div className="pills" role="group" aria-label="The next photo shows"><span className="xs muted nowrap">Next photo:</span>{([["front", "Front"],["angle", "Angled"],["side", "Side"], ["back", "Back"], ["detail", "Close-up"]] as const).map(([v, l]) => <button key={v} type="button" className={clsx("pill sm", view === v && "on")} onClick={() => setView(v)}>{l}</button>)}</div>}</div><p className="xs muted" style={{ marginBottom: 12 }}>Add clear views to preserve the back, sides and small details. Label each photo below; we choose relevant references for each shot.</p>
        <div className="grid grid-cols-3 gap-3">
          {photos.map((p,i) => (
            <div key={p.id} className="group relative">
              <button type="button" aria-label={"Open product photo "+(i+1)} onClick={()=>setPhotoOpen(i)} className="ph r11" style={{ borderRadius: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.url && <FitImg src={p.url} alt={`${p.view} view`} />}
              </button>
              <select aria-label={"View shown in product photo "+(i+1)} className="input" style={{marginTop:6,minHeight:36,fontSize:13}} value={p.view} disabled={!!busy} onChange={async e=>{setBusy("view");try{await api("/api/products/"+product.id+"/photos",{method:"PATCH",json:{assetId:p.id,viewType:e.target.value}});router.refresh();}catch(err){toast((err as Error).message,true);}finally{setBusy(null);}}}>{Object.entries(viewLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
              {photos.length > 1 && (
                <button aria-label="Delete photo" onClick={async () => { await api(`/api/products/${product.id}/photos?assetId=${p.id}`, { method: "DELETE" }).catch((e) => toast(e.message, true)); router.refresh(); }}
                  className="absolute right-1.5 top-1.5 grid size-9 place-items-center rounded-full bg-paper/90"><Trash size={13} /></button>
              )}
            </div>
          ))}
          {photos.length < 6 && (
            <button onClick={() => file.current?.click()} className="grid aspect-square place-items-center rounded-lg border border-dashed border-line text-mute hover:text-ink">
              {busy === "upload" ? <Spinner /> : <ImagePlus />}
            </button>
          )}
        </div>
        <input ref={file} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => {void addPhotos(e.target.files);e.target.value="";}} />
        <input ref={camera} type="file" hidden accept="image/*" capture="environment" onChange={e=>{void addPhotos(e.target.files);e.target.value="";}}/>
        {photos.length<6&&<div className="row" style={{gap:8,marginTop:12,flexWrap:"wrap"}}><Button disabled={!!busy} onClick={()=>camera.current?.click()}><Camera size={17}/>Take {viewLabels[view].toLowerCase()} photo</Button><Button disabled={!!busy} onClick={()=>file.current?.click()}><ImagePlus size={17}/>Upload photo</Button></div>}
        {photoOpen!==null&&<ReferenceViewer photos={photos.filter(p=>!!p.url).map(p=>({url:p.url!,label:viewLabels[p.view]??"Photo"}))} index={photoOpen} onIndex={setPhotoOpen} onClose={()=>setPhotoOpen(null)}/>} 
      </div>
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Name"><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="SKU"><Input value={form.sku} onChange={(e) => setForm({ ...form, sku: e.target.value })} /></Field>
        </div>
        <Field label="Category">
          <Select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {CATEGORY_LIST.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </Select>
        </Field>
        <div>
          <div className="mb-2 text-sm font-medium">What must not change</div>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(LOCKS) as LockId[]).map((l) => {
              const on = form.locks.includes(l);
              return <button key={l} type="button" onClick={() => setForm({ ...form, locks: on ? form.locks.filter((x) => x !== l) : [...form.locks, l] })}
                className={clsx("rounded-full border px-3 py-1 text-sm", on ? "border-ink bg-ink text-paper" : "border-line")}>{LOCKS[l].label}</button>;
            })}
          </div>
        </div>
        <Field label="Anything else that must stay the same"><Textarea value={form.mustNotChange} onChange={(e) => setForm({ ...form, mustNotChange: e.target.value })} /></Field>
        <div className="flex gap-2">
          <Button onClick={() => save()} disabled={!!busy}>{busy === "save" ? <Spinner /> : "Save changes"}</Button>
          <Button variant="ghost" onClick={() => save({ archived: !product.archived })} disabled={!!busy}>{product.archived ? "Restore" : "Archive"}</Button>
        </div>
      </div>
    </div>
  );
}
