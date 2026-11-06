import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Database backups are managed by the PostgreSQL provider." },
    { status: 410 },
  );
}
