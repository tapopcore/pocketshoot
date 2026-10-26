import { LinkButton } from "@/components/ui";

export const metadata = { title: "iPhone & Android" };

export default function Mobile() {
  const ios = process.env.NEXT_PUBLIC_IOS_URL;
  const android = process.env.NEXT_PUBLIC_ANDROID_URL;
  return (
    <div className="mx-auto max-w-5xl px-4 py-16 sm:px-8">
      <div className="eyebrow">iPhone & Android</div>
      <h1 className="display mt-4 max-w-3xl text-6xl">Shoot it on your desk. Get the studio shot on your phone.</h1>
      <p className="mt-5 max-w-2xl text-lg text-ink-2">The app opens straight to the camera with a guide that helps you frame the product. Pick a look, and the finished images arrive on the same phone, ready to save to your gallery or share on WhatsApp.</p>
      <div className="mt-8 flex flex-wrap gap-3">
        {ios ? <LinkButton href={ios}>Download on the App Store</LinkButton> : <span className="rounded-full border border-line px-5 py-2.5 text-sm">iPhone app: coming soon</span>}
        {android ? <LinkButton href={android}>Get it on Google Play</LinkButton> : <span className="rounded-full border border-line px-5 py-2.5 text-sm">Android app: coming soon</span>}
      </div>
      <p className="mt-6 text-sm text-mute">Same account and credits as the website. Credits bought in the app go through Apple or Google.</p>
    </div>
  );
}
