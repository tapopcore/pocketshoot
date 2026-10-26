import { LinkButton } from "@/components/ui";

export const metadata = { title: "How it works" };

const SECTIONS = [
  { n: "01", t: "Take a normal photo", body: ["Put the product on a plain surface near a window. A white sheet of paper works well. Shoot straight on, close enough that the label is sharp.", "Add an angle shot or a back shot if you have one. One good front photo is enough for most styles."], tip: "Avoid the phone flash. It creates glare on glossy labels that we can't remove." },
  { n: "02", t: "Tell us what must not change", body: ["Name the product, pick its category, and tick what must stay exact: label text, logo, colour, shape, cap or lid. Each category has its own rules built in. For packaged food we never touch nutrition tables, FSSAI numbers or veg marks. For jewellery we keep stone count and metal colour."], tip: "These rules are written into every request we send to the AI." },
  { n: "03", t: "Choose the look and size", body: ["Pick from ready-made looks (pure white, marble, botanical, festive, luxury dark and more) or describe your own scene. Pick the size for where the image will go: square for product pages, 4:5 for Instagram, 9:16 for stories, a wide banner for your website, or marketplace white."], tip: "You see the credit cost before anything starts." },
  { n: "04", t: "We build the scene around your product", body: ["In the default mode, we cut your product out of your photo and place it on the new canvas. The AI creates the set, the surface and the shadows. Then we put your original product pixels back on top, so the label and logo are the ones from your photo, not a redrawing.", "Creative mode is there when you want new camera angles or arrangements. There the AI does redraw the product, so small text can change. We tell you that before you choose it."], tip: null },
  { n: "05", t: "Every image is checked", body: ["We check that the product stayed where it was put, that its colour didn't shift, that the image isn't blank or the wrong size, and (in Creative mode) we run a separate AI review comparing your photo with the result. Images that fail are made again automatically. If they still fail, the credit comes back.", "Automatic checks catch most problems, not all. Images that need a closer look are marked so you can check them at 100% zoom."], tip: null },
  { n: "06", t: "Approve, download, publish", body: ["Compare each result against your photo with the slider, zoom to 100%, and download as JPG, PNG or WebP. Download a whole shoot as a ZIP. On Shopify, add approved photos straight to the product.", "Not happy with the look? Each image has one free remake. Did your product change? Report it and the credit comes back, straight away when our checks agree, or within one working day after a person looks."], tip: null },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="eyebrow">How it works</div>
      <h1 className="display mt-4 text-6xl sm:text-7xl">From a desk photo to a catalogue image.</h1>
      <div className="mt-16 space-y-16">
        {SECTIONS.map((s) => (
          <section key={s.n} className="grid gap-6 border-t border-ink pt-6 md:grid-cols-[120px_1fr]">
            <div className="display text-5xl text-accent">{s.n}</div>
            <div>
              <h2 className="display text-4xl">{s.t}</h2>
              {s.body.map((p, i) => <p key={i} className="mt-4 max-w-2xl text-ink-2">{p}</p>)}
              {s.tip && <p className="mt-4 inline-block rounded-lg bg-paper-2 px-3 py-2 text-sm">{s.tip}</p>}
            </div>
          </section>
        ))}
      </div>
      <div className="mt-20 text-center"><LinkButton href="/sign-in" variant="accent" size="lg">Try it with 2 free images</LinkButton></div>
    </div>
  );
}
