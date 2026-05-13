import Link from "next/link";
import { HelpCircle } from "lucide-react";

export function FloatingHelp() {
  return (
    <Link
      href="/about"
      title="看不懂？打开心智模型"
      aria-label="心智模型"
      className="fixed bottom-6 right-6 z-50 flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition hover:scale-105 hover:shadow-xl"
    >
      <HelpCircle className="h-5 w-5" />
    </Link>
  );
}
