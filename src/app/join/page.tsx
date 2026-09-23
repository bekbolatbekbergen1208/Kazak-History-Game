import Join from "../../components/Join";
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ code?: string }>;
}) {
  const params = await searchParams;
  return <Join initialCode={params.code || ""} />;
}
