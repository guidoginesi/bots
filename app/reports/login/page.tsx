import { redirect } from "next/navigation";

type Props = { searchParams: Promise<{ next?: string }> };

export default async function ReportsLoginRedirect({ searchParams }: Props) {
  const { next } = await searchParams;
  const q = next ? `?next=${encodeURIComponent(next)}` : "";
  redirect(`/login${q}`);
}
