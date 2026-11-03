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
    <div className="pe">
      <div className="pe-photos">
        <div className="pe-head"><h2 className="h5">Product photos <span className="sm muted" style={{ fontWeight: 400 }}>{photos.length} of 6</span></h2></div>
        <p className="xs muted pe-hint">Add the back, sides and close-ups so every detail stays right. Pick what each photo shows.</p>
        <div className="pe-grid">
          {photos.map((p,i) => (
            <div key={p.id} className="pe-tile">
              <button type="button" aria-label={"Open product photo "+(i+1)} onClick={()=>setPhotoOpen(i)} className="ph r11 pe-ph">
                {p.url && <FitImg src={p.url} alt={`${p.view} view`} />}
              </button>
              <select aria-label={"View shown in product photo "+(i+1)} className="pe-vt" value={p.view} disabled={!!busy} onChange={async e=>{setBusy("view");try{await api("/api/products/"+product.id+"/photos",{method:"PATCH",json:{assetId:p.id,viewType:e.target.value}});router.refresh();}catch(err){toast((err as Error).message,true);}finally{setBusy(null);}}}>{Object.entries(viewLabels).map(([v,l])=><option key={v} value={v}>{l}</option>)}</select>
              {photos.length > 1 && (
                <button type="button" aria-label="Delete photo" className="pe-rm" onClick={async () => { await api(`/api/products/${product.id}/photos?assetId=${p.id}`, { method: "DELETE" }).catch((e) => toast(e.message, true)); router.refresh(); }}><Trash size={13} /></button>
              )}
            </div>
          ))}
          {photos.length < 6 && (
            <button type="button" onClick={() => file.current?.click()} className="pe-add" aria-label="Add a photo">
              {busy === "upload" ? <Spinner /> : <><ImagePlus size={20} /><span>Add</span></>}
            </button>
          )}
        </div>
        <input ref={file} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => {void addPhotos(e.target.files);e.target.value="";}} />
        <input ref={camera} type="file" hidden accept="image/*" capture="environment" onChange={e=>{void addPhotos(e.target.files);e.target.value="";}}/>
        {photos.length < 6 && <>
          <div className="pe-next" role="group" aria-label="The next photo shows"><span className="xs muted">Next photo is a</span>{([["front", "front"],["angle", "angled"],["side", "side"], ["back", "back"], ["detail", "close-up"]] as const).map(([v, l]) => <button key={v} type="button" className={clsx("pill sm", view === v && "on")} onClick={() => setView(v)}>{l}</button>)}</div>
          <div className="pe-add2"><button type="button" className="btn btn-line" disabled={!!busy} onClick={()=>camera.current?.click()}><Camera size={17}/>Take photo</button><button type="button" className="btn btn-line" disabled={!!busy} onClick={()=>file.current?.click()}><ImagePlus size={17}/>Upload</button></div>
        </>}
        {photoOpen!==null&&<ReferenceViewer photos={photos.filter(p=>!!p.url).map(p=>({url:p.url!,label:viewLabels[p.view]??"Photo"}))} index={photoOpen} onIndex={setPhotoOpen} onClose={()=>setPhotoOpen(null)}/>}
      </div>
      <div className="pe-form space-y-5">
        <div className="pe-2col">
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
          <div className="pe-locks">
            {(Object.keys(LOCKS) as LockId[]).map((l) => {
              const on = form.locks.includes(l);
              return <button key={l} type="button" onClick={() => setForm({ ...form, locks: on ? form.locks.filter((x) => x !== l) : [...form.locks, l] })}
                aria-pressed={on} className={clsx("pill sm", on && "on")}>{LOCKS[l].label}</button>;
            })}
          </div>
        </div>
        <Field label="Anything else that must stay the same"><Textarea value={form.mustNotChange} onChange={(e) => setForm({ ...form, mustNotChange: e.target.value })} /></Field>
        <div className="pe-actions">
          <Button onClick={() => save()} disabled={!!busy}>{busy === "save" ? <Spinner /> : "Save changes"}</Button>
          <Button variant="ghost" onClick={() => save({ archived: !product.archived })} disabled={!!busy}>{product.archived ? "Restore" : "Archive"}</Button>
        </div>
      </div>
    </div>
  );
}
