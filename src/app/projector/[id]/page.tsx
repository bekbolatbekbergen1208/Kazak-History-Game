import Projector from "../../../components/Projector";
export default async function Page({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ key?: string }>;
}) {
  return (
    <Projector id={(await params).id} accessKey={(await searchParams).key} />
  );
}
