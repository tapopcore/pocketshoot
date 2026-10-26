import { LinkButton, Logo } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="grid min-h-dvh place-items-center px-6 text-center">
      <div>
        <Logo />
        <div className="display mt-10 text-8xl text-accent">404</div>
        <p className="mt-2 text-ink-2">This frame is empty. The page may have moved or you may not have access to it.</p>
        <LinkButton href="/" className="mt-8">Go home</LinkButton>
      </div>
    </main>
  );
}
