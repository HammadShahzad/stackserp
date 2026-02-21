import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";
import { checkIpRateLimit, validateEmail } from "@/lib/api-helpers";

export async function POST(req: Request) {
  try {
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const rl = checkIpRateLimit(`register:${ip}`);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: "Too many attempts. Please try again later." },
        { status: 429 }
      );
    }

    const { name, email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: "Email and password are required" },
        { status: 400 }
      );
    }

    if (!validateEmail(email)) {
      return NextResponse.json(
        { error: "Please provide a valid email address" },
        { status: 400 }
      );
    }

    if (typeof password !== "string" || password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: "Password must contain an uppercase letter, a lowercase letter, and a number" },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: "An account with this email already exists" },
        { status: 409 }
      );
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await prisma.user.create({
      data: {
        name: typeof name === "string" ? name.trim() : undefined,
        email: normalizedEmail,
        password: hashedPassword,
      },
    });

    const org = await prisma.organization.create({
      data: {
        name: `${name || normalizedEmail.split("@")[0]}'s Organization`,
        slug: `org-${user.id.slice(0, 8)}`,
        members: {
          create: {
            userId: user.id,
            role: "OWNER",
          },
        },
      },
    });

    await prisma.subscription.create({
      data: {
        stripeCustomerId: `pending_${user.id}`,
        plan: "FREE",
        status: "ACTIVE",
        organizationId: org.id,
        userId: user.id,
        maxWebsites: 1,
        maxPostsPerMonth: 2,
        maxImagesPerMonth: 2,
      },
    });

    return NextResponse.json(
      { message: "Account created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Something went wrong" },
      { status: 500 }
    );
  }
}
