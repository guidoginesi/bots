import { NextResponse } from "next/server";
import {
  REPORTS_COOKIE,
  getReportsSessionToken,
  reportsAuthConfigured,
} from "@/lib/reportsAuth";

const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 días

export async function POST(request: Request) {
  if (!reportsAuthConfigured()) {
    return NextResponse.json(
      { error: "REPORTS_PASSWORD no está configurada en el servidor." },
      { status: 503 }
    );
  }

  let password = "";
  try {
    const body = (await request.json()) as { password?: string };
    password = body.password?.trim() ?? "";
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400 });
  }

  if (password !== process.env.REPORTS_PASSWORD) {
    return NextResponse.json(
      { error: "Contraseña incorrecta." },
      { status: 401 }
    );
  }

  const token = await getReportsSessionToken();
  const response = NextResponse.json({ ok: true });
  response.cookies.set(REPORTS_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_MAX_AGE,
  });
  return response;
}

export async function DELETE() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(REPORTS_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return response;
}
