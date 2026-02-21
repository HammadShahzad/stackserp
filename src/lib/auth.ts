import { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

const TOKEN_CACHE = new Map<string, { data: Record<string, unknown>; expiresAt: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000;

function getCachedTokenData(userId: string) {
  const cached = TOKEN_CACHE.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.data;
  TOKEN_CACHE.delete(userId);
  return null;
}

function setCachedTokenData(userId: string, data: Record<string, unknown>) {
  TOKEN_CACHE.set(userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

export const authOptions: NextAuthOptions = {
  session: {
    strategy: "jwt",
    maxAge: 30 * 24 * 60 * 60,
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password are required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });

        if (!user) {
          throw new Error("Invalid email or password");
        }

        if (!user.password) {
          throw new Error("Invalid email or password");
        }

        const isValid = await bcrypt.compare(credentials.password, user.password);
        if (!isValid) {
          throw new Error("Invalid email or password");
        }

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          image: user.image,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const email = user.email?.toLowerCase();
        if (!email) return false;

        let dbUser = await prisma.user.findUnique({
          where: { email },
        });

        if (!dbUser) {
          // First-time Google sign-in: create user + org + free subscription
          const newUser = await prisma.user.create({
            data: {
              email,
              name: user.name || email.split("@")[0],
              image: user.image || null,
              password: null,
              emailVerified: new Date(),
            },
          });

          const org = await prisma.organization.create({
            data: {
              name: `${newUser.name}'s Organization`,
              slug: `org-${newUser.id.slice(0, 8)}`,
              members: {
                create: {
                  userId: newUser.id,
                  role: "OWNER",
                },
              },
            },
          });

          await prisma.subscription.create({
            data: {
              stripeCustomerId: `pending_${newUser.id}`,
              plan: "FREE",
              status: "ACTIVE",
              organizationId: org.id,
              userId: newUser.id,
              maxWebsites: 1,
              maxPostsPerMonth: 2,
              maxImagesPerMonth: 2,
            },
          });
        } else {
          // Existing user signing in with Google — update profile pic if needed
          const updateData: Record<string, unknown> = {};
          if (user.image && user.image !== dbUser.image) {
            updateData.image = user.image;
          }
          if (!dbUser.emailVerified) {
            updateData.emailVerified = new Date();
          }
          if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
              where: { id: dbUser.id },
              data: updateData,
            });
          }
        }
      }
      return true;
    },
    async jwt({ token, user, account, trigger, session }) {
      // Google sign-in: fetch DB user to get proper ID
      if (account?.provider === "google") {
        const dbUser = await prisma.user.findUnique({
          where: { email: token.email?.toLowerCase() || "" },
          select: { id: true, name: true, image: true, role: true },
        });
        if (dbUser) {
          token.id = dbUser.id;
          token.name = dbUser.name || token.name;
          token.picture = dbUser.image || undefined;
          TOKEN_CACHE.delete(dbUser.id);
        }
      } else if (user) {
        token.id = user.id;
        TOKEN_CACHE.delete(user.id);
      }

      if (token.id) {
        const userId = token.id as string;

        if (trigger === "update") {
          TOKEN_CACHE.delete(userId);
          if (session?.organizationId) {
            token.organizationId = session.organizationId;
          }
        }

        const cached = getCachedTokenData(userId);
        if (cached) {
          Object.assign(token, cached);
        } else {
          const [dbUser, membership] = await Promise.all([
            prisma.user.findUnique({
              where: { id: userId },
              select: { role: true },
            }),
            prisma.organizationMember.findFirst({
              where: { userId },
              include: { organization: true },
              orderBy: { createdAt: "asc" },
            }),
          ]);

          const data: Record<string, unknown> = {};

          if (dbUser) {
            token.systemRole = dbUser.role;
            data.systemRole = dbUser.role;
          }

          if (membership) {
            token.organizationId = membership.organization.id;
            token.organizationName = membership.organization.name;
            token.role = membership.role;
            data.organizationId = membership.organization.id;
            data.organizationName = membership.organization.name;
            data.role = membership.role;
          }

          setCachedTokenData(userId, data);
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.organizationId = token.organizationId as string;
        session.user.organizationName = token.organizationName as string;
        session.user.role = token.role as string;
        session.user.systemRole = token.systemRole as string;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
