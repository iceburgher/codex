import { CompareView } from "@/components/CompareView";

export default async function ComparePage({ searchParams }: PageProps<"/compare">) {
  const params = await searchParams;
  const raw = params.ids;
  const ids = typeof raw === "string" ? raw.split(",").filter(Boolean) : [];
  return <CompareView initialIds={ids} />;
}
