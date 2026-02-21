import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, ArrowRight } from "lucide-react";

const STACKSERP_SUBDOMAIN = "stackserp";

export const metadata: Metadata = {
  title: "Blog | StackSerp - AI SEO & Content Marketing Insights",
  description:
    "Expert insights on AI-powered SEO, content marketing, and blog automation. Learn how to rank higher with less effort.",
  openGraph: {
    title: "StackSerp Blog",
    description:
      "Expert insights on AI-powered SEO, content marketing, and blog automation.",
    type: "website",
  },
  alternates: {
    canonical: `${process.env.NEXTAUTH_URL || "https://stackserp.com"}/blogs`,
  },
};

export const revalidate = 60;

export default async function BlogsPage() {
  let posts: {
    id: string;
    title: string;
    slug: string;
    excerpt: string | null;
    featuredImage: string | null;
    featuredImageAlt: string | null;
    publishedAt: Date | null;
    readingTime: number | null;
    category: string | null;
    tags: string[];
    wordCount: number | null;
    content: string | null;
  }[] = [];

  try {
    const website = await prisma.website.findUnique({
      where: { subdomain: STACKSERP_SUBDOMAIN },
    });

    if (website) {
      posts = await prisma.blogPost.findMany({
        where: { websiteId: website.id, status: "PUBLISHED" },
        orderBy: { publishedAt: "desc" },
        take: 50,
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          featuredImage: true,
          featuredImageAlt: true,
          publishedAt: true,
          readingTime: true,
          category: true,
          tags: true,
          wordCount: true,
          content: true,
        },
      });
    }
  } catch {
    // DB not available at build time — ISR will populate on first request
  }

  const baseUrl = process.env.NEXTAUTH_URL || "https://stackserp.com";

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "StackSerp",
    url: "https://stackserp.com",
    description: "AI-powered blog generation and SEO automation platform",
  };

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: "StackSerp Blog",
    description: "Expert insights on AI-powered SEO, content marketing, and blog automation.",
    url: `${baseUrl}/blogs`,
    publisher: {
      "@type": "Organization",
      name: "StackSerp",
      url: "https://stackserp.com",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />

      {/* Nav */}
      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-50 to-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-3">
            StackSerp Blog
          </h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            Expert insights on AI-powered SEO, content marketing, and blog automation.
          </p>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {posts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">Blog posts coming soon.</p>
            <p className="text-sm mt-1">Check back shortly!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => {
              const rt =
                post.readingTime ||
                Math.max(
                  1,
                  Math.ceil((post.content?.split(/\s+/).length || 0) / 200)
                );
              return (
                <Link
                  key={post.id}
                  href={`/blogs/${post.slug}`}
                  className="group rounded-2xl border bg-white hover:shadow-lg transition-all overflow-hidden flex flex-col"
                >
                  {post.featuredImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={post.featuredImage}
                      alt={post.featuredImageAlt || post.title}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
                    />
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      {post.category && (
                        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                          {post.category}
                        </span>
                      )}
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {rt} min
                      </span>
                    </div>
                    <h2 className="text-lg font-semibold text-foreground group-hover:text-primary transition-colors mb-2 line-clamp-2">
                      {post.title}
                    </h2>
                    {post.excerpt && (
                      <p className="text-sm text-muted-foreground line-clamp-3 mb-4 flex-1">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center justify-between text-xs text-muted-foreground mt-auto">
                      <span>StackSerp</span>
                      {post.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.publishedAt).toLocaleDateString(
                            "en-US",
                            {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            }
                          )}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      {/* CTA */}
      <div className="border-t bg-slate-50 py-16">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h2 className="text-2xl font-bold mb-3">
            Ready to automate your SEO content?
          </h2>
          <p className="text-muted-foreground mb-6">
            Generate high-quality blog posts in minutes, not hours.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold px-6 py-3 rounded-xl hover:bg-primary/90 transition-colors"
          >
            Start for Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </>
  );
}
