import { redirect } from "next/navigation";

// Old shop URLs now point to the checkout link.
export default async function OldProduct({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/p/${id}`);
}
