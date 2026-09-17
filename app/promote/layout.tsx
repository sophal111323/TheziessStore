import type { ReactNode } from "react";
import CreatorShell from "./CreatorShell";

export const dynamic = "force-dynamic";

export default function PromoteLayout({ children }: { children: ReactNode }) {
  return <CreatorShell>{children}</CreatorShell>;
}

