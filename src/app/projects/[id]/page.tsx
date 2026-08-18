import { ProjectDashboard } from "@/components/ProjectDashboard";

export default async function ProjectPage({ params }: PageProps<"/projects/[id]">) {
  const { id } = await params;
  return <ProjectDashboard projectId={id} />;
}
