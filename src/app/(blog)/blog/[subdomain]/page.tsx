import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowRight } from "lucide-react";

interface Props {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const website = await prisma.website.findUnique({
    where: { subdomain },
  });

  if (!website) return { title: "Blog Not Found" };

  return {
    title: `${website.brandName} Blog`,
    description: website.description,
    openGraph: {
      title: `${website.brandName} Blog`,
      description: website.description,
      type: "website",
    },
  };
}

export default async function PublicBlogListPage({ params }: Props) {
  const { subdomain } = await params;

  const website = await prisma.website.findUnique({
    where: { subdomain },
  });

  if (!website) notFound();

  const posts = await prisma.blogPost.findMany({
    where: { websiteId: website.id, status: "PUBLISHED" },
    orderBy: { publishedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      publishedAt: true,
      readingTime: true,
      focusKeyword: true,
      category: true,
      tags: true,
      wordCount: true,
    },
  });

  const brandColor = website.primaryColor || "#4F46E5";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header
        className="py-12 px-4 text-white"
        style={{ backgroundColor: brandColor }}
      >
        <div className="max-w-4xl mx-auto">
          <a
            href={website.brandUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/70 hover:text-white text-sm mb-2 block"
          >
            ← {website.brandName}
          </a>
          <h1 className="text-4xl font-bold">{website.brandName} Blog</h1>
          <p className="text-white/80 mt-2 text-lg">{website.description}</p>
          <div className="flex items-center gap-2 mt-4">
            <Badge
              variant="outline"
              className="text-white border-white/30 text-xs"
            >
              {posts.length} article{posts.length !== 1 ? "s" : ""}
            </Badge>
            <Badge
              variant="outline"
              className="text-white border-white/30 text-xs"
            >
              {website.niche}
            </Badge>
          </div>
        </div>
      </header>

      {/* Posts */}
      <main className="max-w-4xl mx-auto px-4 py-10">
        {posts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg">No posts published yet.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="space-y-8">
            {posts.map((post, i) => (
              <article
                key={post.id}
                className={`group ${i === 0 ? "border-b pb-8" : ""}`}
              >
                <div
                  className={`${i === 0 ? "md:flex gap-8 items-start" : "border rounded-xl p-6 hover:shadow-md transition-shadow"}`}
                >
                  {post.featuredImage && (
                    <div
                      className={`${i === 0 ? "md:w-72 md:shrink-0 mb-4 md:mb-0" : "mb-4"} overflow-hidden rounded-lg`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={post.featuredImage}
                        alt={post.title}
                        className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                  )}
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {post.category && (
                        <Badge variant="secondary" className="text-xs">
                          {post.category}
                        </Badge>
                      )}
                    </div>
                    <Link
                      href={`/blog/${subdomain}/${post.slug}`}
                      className="hover:text-primary"
                    >
                      <h2
                        className={`font-bold leading-tight ${i === 0 ? "text-2xl" : "text-lg"}`}
                      >
                        {post.title}
                      </h2>
                    </Link>
                    {post.excerpt && (
                      <p className="text-muted-foreground mt-2 text-sm leading-relaxed line-clamp-2">
                        {post.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-4 mt-3 text-xs text-muted-foreground">
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
                      {post.readingTime && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {post.readingTime} min read
                        </span>
                      )}
                    </div>
                    <Link
                      href={`/blog/${subdomain}/${post.slug}`}
                      className="inline-flex items-center gap-1 mt-3 text-sm font-medium hover:text-primary"
                      style={{ color: brandColor }}
                    >
                      Read more
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t py-8 mt-10">
        <div className="max-w-4xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Content by{" "}
            <a
              href={website.brandUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-primary"
            >
              {website.brandName}
            </a>{" "}
            · Powered by{" "}
            <a href="/" className="hover:text-primary">
              StackSerp
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
