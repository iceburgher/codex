import { NextResponse } from "next/server";
import { migrateProject } from "@/lib/migrations";
import { PROJECTS_TABLE, getSupabase, supabaseConfigured } from "@/lib/supabase";
import type { PropertyProject } from "@/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Projektlagring i Supabase.
 *
 * All åtkomst går via servern så att den hemliga nyckeln aldrig lämnar den.
 * Är lagringen inte konfigurerad svarar rutten med `configured: false`, och
 * klienten fortsätter spara lokalt i webbläsaren i stället för att fela.
 */
export async function GET() {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ configured: false, projects: [] });

  const { data, error } = await supabase
    .from(PROJECTS_TABLE)
    .select("data")
    .order("updated_at", { ascending: false });

  if (error) {
    return NextResponse.json({ configured: true, error: error.message }, { status: 502 });
  }

  const projects = (data ?? []).map((row) =>
    migrateProject((row as { data: Record<string, unknown> }).data),
  );
  return NextResponse.json({ configured: true, projects });
}

export async function PUT(request: Request) {
  const supabase = getSupabase();
  if (!supabase) {
    return NextResponse.json({ configured: false }, { status: 200 });
  }

  const body = (await request.json()) as { project?: PropertyProject };
  const project = body.project;

  if (!project || typeof project.id !== "string") {
    return NextResponse.json({ error: "Projektet saknar id." }, { status: 400 });
  }

  const { error } = await supabase.from(PROJECTS_TABLE).upsert(
    {
      id: project.id,
      name: project.name,
      archived: project.archived,
      updated_at: project.updatedAt,
      data: project,
    },
    { onConflict: "id" },
  );

  if (error) {
    return NextResponse.json({ configured: true, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ configured: true, ok: true });
}

export async function DELETE(request: Request) {
  const supabase = getSupabase();
  if (!supabase) return NextResponse.json({ configured: false }, { status: 200 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Id saknas." }, { status: 400 });

  const { error } = await supabase.from(PROJECTS_TABLE).delete().eq("id", id);
  if (error) {
    return NextResponse.json({ configured: true, error: error.message }, { status: 502 });
  }
  return NextResponse.json({ configured: true, ok: true });
}

/** Låter klienten visa var projekten faktiskt hamnar. */
export async function HEAD() {
  return new Response(null, {
    status: 200,
    headers: { "x-storage": supabaseConfigured() ? "supabase" : "local" },
  });
}
