export const metadata = { title: "FAQ" };

const QA: [string, string][] = [
  ["Will my label and logo stay exactly the same?", "In the default mode, yes for the product itself: we cut your product out of your photo and put your original pixels back after the new scene is made. What can go wrong is the cut-out edge (a cap or handle clipped) or lighting that doesn't quite match. Our checks catch most of these. You review every image before using it, and if the product changed, the credit comes back."],
  ["What's the difference between the two modes?", "\"Keep my product exact\" keeps your product pixels and only creates the surroundings. It's right for packaging and anything with text. \"Creative\" lets the AI redraw the product for new angles and arrangements. It looks more varied, but labels and small text can change."],
  ["What photo should I upload?", "A sharp photo of the front of the product on a plain surface, in soft daylight. At least 500px on the shorter side; a normal phone photo is far more than enough. JPG, PNG or WebP. Add an angle or back photo if you have one."],
  ["Which products work best?", "Bottles, jars, tubes, boxes, pouches, cups, cookware, decor and accessories. Jewellery works but is harder because of reflections. Clear glass, very shiny metal, clothing on people, and products with many small parts are the hardest."],
  ["How long does it take?", "Usually 20 to 60 seconds per image. A shoot of 4 images is typically ready in about a minute. Batches of hundreds run in the background and you can leave the page."],
  ["When is a credit used?", "When we reserve credits at the start, nothing is spent yet. A credit is used only when an image is delivered. If an image fails, or doesn't pass our checks after retries, its credit is returned automatically."],
  ["What if I don't like an image?", "Every image has one free remake within 7 days. After that a remake uses a credit. If the problem is that your product changed, report it instead and you'll get the credit back."],
  ["Can I use the images commercially?", "Yes. The images you make are yours to use for your products: your website, marketplaces, ads, catalogues and packaging. You need to own or have rights to the product and brand in the photo you upload."],
  ["Are the images accepted on Amazon, Flipkart and Meesho?", "Many sellers use our Marketplace white size for listings. Each marketplace has its own image rules that change over time, so check their current guidelines before listing. We don't guarantee acceptance."],
  ["Do you use my photos to train AI?", "No. We don't train models on your photos or images. They're stored privately, only your team can see them, and you can ask us to delete them."],
  ["Do I get a GST invoice?", "Yes, for every purchase on the website. Add your GSTIN at checkout or in Settings to get a business invoice for input tax credit."],
  ["Is there a Hindi version?", "The main screens are available in Hindi. Switch in Settings. More languages are planned."],
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
