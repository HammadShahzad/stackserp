import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as NextAuthOptions["adapter"],
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    CredentialsProvider({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Email and password required");
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
        });

        if (!user || !user.password) {
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
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id;
      }

      // Load organization data
      if (token.id) {
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true }
        });
        if (dbUser) {
          token.systemRole = dbUser.role;
        }

        const membership = await prisma.organizationMember.findFirst({
          where: { userId: token.id as string },
          include: { organization: true },
          orderBy: { createdAt: "asc" },
        });

        if (membership) {
          token.organizationId = membership.organization.id;
          token.organizationName = membership.organization.name;
          token.role = membership.role;
        }
      }

      // Allow updating session from client
      if (trigger === "update" && session?.organizationId) {
        token.organizationId = session.organizationId;
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
  events: {
    async createUser({ user }) {
      // Auto-create organization for new users
      const org = await prisma.organization.create({
        data: {
          name: `${user.name || user.email?.split("@")[0]}'s Organization`,
          slug: `org-${user.id.slice(0, 8)}`,
          members: {
            create: {
              userId: user.id,
              role: "OWNER",
            },
          },
        },
      });

      // Create free subscription
      // Note: Stripe customer creation would happen here in production
      await prisma.subscription.create({
        data: {
          stripeCustomerId: `temp_${user.id}`, // Replace with real Stripe customer ID
          plan: "FREE",
          status: "ACTIVE",
          organizationId: org.id,
          userId: user.id,
          maxWebsites: 1,
          maxPostsPerMonth: 5,
          maxImagesPerMonth: 5,
        },
      });
    },
  },
};
