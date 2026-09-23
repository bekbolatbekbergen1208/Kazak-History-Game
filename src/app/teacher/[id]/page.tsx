import Teacher from "../../../components/Teacher";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  return <Teacher id={(await params).id} />;
}
