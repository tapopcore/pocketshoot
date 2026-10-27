export const metadata = { title: "FAQ" };

const QA: [string, string][] = [
  [
    "Will my product stay exactly the same?",
    "Your references guide the actual product identity. We check design, text, shape, colour and the selected direction, but AI checks cannot guarantee every fine detail. Inspect the result before publishing; report any product change from the viewer."
  ],
  [
    "Why are styles different for each product?",
    "A saree needs different art direction from a serum or a ring. Confirm the product type, then choose from a small set of compatible visual references. Some poses need another photo or a detail view."
  ],
  [
    "What photo should I upload?",
    "Start with a sharp front view in soft light, at least 500px on the shorter side. JPG, PNG and WebP are supported. Add another angle, a back view or a close-up when the selected direction needs it. For clothing, model poses currently need a reference of the finished garment being worn."
  ],
  [
    "Do previews use image-generation credits?",
    "Browsing the pre-authored style library does not create an image-generation request. Your own shoot begins only after you review the total and press Create."
  ],
  [
    "How long does a shoot take?",
    "Timing depends on the provider, queue and image checks. The saved shoot page shows the actual stage and elapsed time. You can leave and reopen it from Shoots."
  ],
  [
    "When are credits used?",
    "The total is shown before Create. Credits are reserved for the accepted job, captured for delivered images, and released for failed images. Reports show their review and credit outcome."
  ],
  [
    "Do images have a watermark?",
    "New images are delivered without an added Pocket Shoot watermark, including trial images. Older files can still contain a historical watermark; start a new shoot from the original product photo for a clean replacement."
  ],
  [
    "Can I change the output size?",
    "You can download the same photo fitted into another supported shape for free, keeping the entire photo with white margins. A genuinely new scene or composition is a separate generation."
  ],
  [
    "Can I use the images commercially?",
    "Use images for products and brands you own or have permission to represent. Review fine details and the requirements of your destination marketplace before publishing."
  ],
  [
    "Can I return to a shoot later?",
    "Yes. Accepted shoots have permanent links in Shoots. Product-based drafts are saved in this browser for the active workspace."
  ],
  [
    "Where is my account?",
    "Open Account in the mobile bottom navigation to see your email, active workspace, credits and workspace tools."
  ]
];

export default function Faq() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-8">
      <div className="eyebrow">FAQ</div>
      <h1 className="display mt-4 text-6xl">Straight answers.</h1>
      <div className="mt-12 divide-y divide-line border-y border-line">
        {QA.map(([q, a]) => (
          <details key={q} className="group py-5">
            <summary className="flex cursor-pointer list-none items-start justify-between gap-4 text-lg font-medium">{q}<span className="text-accent transition-transform group-open:rotate-45">+</span></summary>
            <p className="mt-3 text-ink-2">{a}</p>
          </details>
        ))}
      </div>
    </div>
  );
}
