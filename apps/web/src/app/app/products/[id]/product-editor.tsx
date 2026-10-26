"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ImagePlus, Trash } from "lucide-react";
import { CATEGORY_LIST, LOCKS, type LockId } from "@packshot/core";
import { api, toast, uploadFiles } from "@/lib/client";
import { Button, Field, Input, Select, Spinner, Textarea } from "@/components/ui";

export function ProductEditor({ product, photos }: {
  product: { id: string; name: string; category: string; sku: string | null; locks: string[]; mustNotChange: string | null; archived: boolean };
  photos: { id: string; url: string | null; view: string; size: string; cutout: string | null }[];
}) {
  const router = useRouter();
  const [form, setForm] = useState({ name: product.name, category: product.category, sku: product.sku ?? "", locks: product.locks, mustNotChange: product.mustNotChange ?? "" });
  const [busy, setBusy] = useState<string | null>(null);
  const file = useRef<HTMLInputElement>(null);

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
    if (!files?.length) return;
    setBusy("upload");
    try {
      const keys = await uploadFiles(Array.from(files).slice(0, 3));
      await api(`/api/products/${product.id}/photos`, { method: "POST", json: { uploads: keys.map((k) => ({ key: k, viewType: "angle" })) } });
      router.refresh();
    } catch (e) { toast((e as Error).message, true); }
    setBusy(null);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-[1fr_1.1fr]">
      <div>
        <div className="eyebrow mb-3">Reference photos</div>
        <div className="grid grid-cols-3 gap-3">
          {photos.map((p) => (
            <div key={p.id} className="group relative">
              <div className="aspect-square overflow-hidden rounded-lg border border-line bg-card">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {p.url && <img src={p.url} alt={`${p.view} view`} className="size-full object-cover" />}
              </div>
              <div className="frame-no mt-1">{p.view} · {p.size}{p.cutout === null ? "" : p.cutout ? " · cut out" : ""}</div>
              {photos.length > 1 && (
                <button aria-label="Delete photo" onClick={async () => { await api(`/api/products/${product.id}/photos?assetId=${p.id}`, { method: "DELETE" }).catch((e) => toast(e.message, true)); router.refresh(); }}
                  className="absolute right-1.5 top-1.5 grid size-7 place-items-center rounded-full bg-paper/90 opacity-0 transition-opacity group-hover:opacity-100"><Trash size={13} /></button>
              )}
            </div>
          ))}
          {photos.length < 5 && (
            <button onClick={() => file.current?.click()} className="grid aspect-square place-items-center rounded-lg border border-dashed border-line text-mute hover:text-ink">
              {busy === "upload" ? <Spinner /> : <ImagePlus />}
            </button>
          )}
        </div>
        <input ref={file} type="file" hidden multiple accept="image/jpeg,image/png,image/webp" onChange={(e) => addPhotos(e.target.files)} />
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
