import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

// Use a dedicated REVALIDATE_SECRET (not the auth secret).
// Set in .env:  REVALIDATE_SECRET="<random-hex>"
// Call with:    Authorization: Bearer <REVALIDATE_SECRET>
//               POST /api/revalidate  body: { "path": "/dashboard/..." }
export async function POST(req: Request) {
  const authHeader = req.headers.get("authorization");
  const secret = process.env.REVALIDATE_SECRET;

  if (!secret) {
    return NextResponse.json({ error: "REVALIDATE_SECRET not configured" }, { status: 500 });
  }

  const provided = authHeader?.replace(/^Bearer /, "") || "";
  let authorized = false;
  try {
    // Constant-time comparison to prevent timing attacks
    authorized =
      provided.length === secret.length &&
      timingSafeEqual(Buffer.from(provided), Buffer.from(secret));
  } catch {
    authorized = false;
  }

  if (!authorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const { path } = body;

  if (!path || typeof path !== "string") {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  // Prevent path traversal: only allow absolute paths starting with /
  if (!path.startsWith("/")) {
    return NextResponse.json({ error: "path must start with /" }, { status: 400 });
  }

  revalidatePath(path);
  return NextResponse.json({ revalidated: true, path });
}
