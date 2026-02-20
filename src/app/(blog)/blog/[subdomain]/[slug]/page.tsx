import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, ArrowLeft, Share2 } from "lucide-react";

interface Props {
  params: Promise<{ subdomain: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain, slug } = await params;

  const website = await prisma.website.findUnique({ where: { subdomain } });
  if (!website) return { title: "Post Not Found" };

  const post = await prisma.blogPost.findUnique({
    where: { websiteId_slug: { websiteId: website.id, slug } },
  });

  if (!post) return { title: "Post Not Found" };

  return {
    title: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || undefined,
    openGraph: {
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt || undefined,
      images: post.featuredImage ? [post.featuredImage] : [],
      type: "article",
      publishedTime: post.publishedAt?.toISOString(),
    },
    twitter: {
      card: "summary_large_image",
      title: post.metaTitle || post.title,
      description: post.metaDescription || post.excerpt || undefined,
      images: post.featuredImage ? [post.featuredImage] : [],
    },
  };
}

function renderMarkdown(content: string): string {
  return content
    .replace(/^# (.+)$/gm, "<h1 class='text-3xl font-bold mt-8 mb-4'>$1</h1>")
    .replace(/^## (.+)$/gm, "<h2 class='text-2xl font-bold mt-8 mb-3'>$1</h2>")
    .replace(/^### (.+)$/gm, "<h3 class='text-xl font-semibold mt-6 mb-2'>$1</h3>")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/`(.+?)`/g, "<code class='bg-muted px-1.5 py-0.5 rounded text-sm font-mono'>$1</code>")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "<a href='$2' class='text-primary underline underline-offset-2 hover:opacity-80' target='_blank' rel='noopener noreferrer'>$1</a>")
    .replace(/^- (.+)$/gm, "<li class='ml-4 list-disc'>$1</li>")
    .replace(/^(\d+)\. (.+)$/gm, "<li class='ml-4 list-decimal'>$2</li>")
    .replace(/\n\n/g, "</p><p class='mb-4 leading-relaxed text-muted-foreground'>")
    .replace(/^(?!<[h|l|p])/gm, "<p class='mb-4 leading-relaxed text-muted-foreground'>")
    .replace(/(?<!>)\n$/gm, "</p>");
}

export default async function PublicBlogPostPage({ params }: Props) {
  const { subdomain, slug } = await params;

  const website = await prisma.website.findUnique({ where: { subdomain } });
  if (!website) notFound();

  const post = await prisma.blogPost.findUnique({
    where: { websiteId_slug: { websiteId: website.id, slug } },
  });

  if (!post || post.status !== "PUBLISHED") notFound();

  // Increment views
  await prisma.blogPost.update({
    where: { id: post.id },
    data: { views: { increment: 1 } },
  });

  // Related posts
  const related = await prisma.blogPost.findMany({
    where: {
      websiteId: website.id,
      status: "PUBLISHED",
      id: { not: post.id },
    },
    orderBy: { publishedAt: "desc" },
    take: 3,
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      featuredImage: true,
      readingTime: true,
      publishedAt: true,
    },
  });

  const brandColor = website.primaryColor || "#4F46E5";

  return (
    <div className="min-h-screen bg-background">
      {/* Structured Data */}
      {post.structuredData && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(post.structuredData),
          }}
        />
      )}

      {/* Top bar */}
      <div
        className="py-3 px-4 text-white text-sm"
        style={{ backgroundColor: brandColor }}
      >
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Link
            href={`/blog/${subdomain}`}
            className="flex items-center gap-1.5 text-white/80 hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            {website.brandName} Blog
          </Link>
          <a
            href={website.brandUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-white/80 hover:text-white"
          >
            {website.domain} ↗
          </a>
        </div>
      </div>

      <article className="max-w-3xl mx-auto px-4 py-10">
        {/* Category / tags */}
        {(post.category || (post.tags && post.tags.length > 0)) && (
          <div className="flex items-center gap-2 mb-4">
            {post.category && (
              <Badge variant="secondary" className="text-xs">
                {post.category}
              </Badge>
            )}
            {post.tags?.slice(0, 3).map((tag) => (
              <Badge key={tag} variant="outline" className="text-xs">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Title */}
        <h1 className="text-3xl md:text-4xl font-bold leading-tight mb-4">
          {post.title}
        </h1>

        {/* Meta */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground mb-6">
          {post.publishedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3.5 w-3.5" />
              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
          {post.readingTime && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {post.readingTime} min read
            </span>
          )}
          {post.wordCount && (
            <span>{post.wordCount.toLocaleString()} words</span>
          )}
        </div>

        {/* Featured Image */}
        {post.featuredImage && (
          <div className="mb-8 overflow-hidden rounded-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.featuredImage}
              alt={post.featuredImageAlt || post.title}
              className="w-full h-64 md:h-80 object-cover"
            />
          </div>
        )}

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-lg text-muted-foreground leading-relaxed mb-8 pb-8 border-b font-medium">
            {post.excerpt}
          </p>
        )}

        {/* Content */}
        <div
          className="prose prose-neutral max-w-none"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(post.content) }}
        />

        {/* Share */}
        <div className="mt-10 pt-6 border-t flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Found this helpful?</p>
            <p className="text-xs text-muted-foreground">
              Share it with your network
            </p>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(`${process.env.NEXTAUTH_URL}/blog/${subdomain}/${post.slug}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" />
              Share
            </a>
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {related.length > 0 && (
        <div className="border-t py-10">
          <div className="max-w-3xl mx-auto px-4">
            <h2 className="text-xl font-bold mb-6">Related Articles</h2>
            <div className="grid gap-4 md:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/blog/${subdomain}/${r.slug}`}
                  className="group block border rounded-xl overflow-hidden hover:shadow-md transition-shadow"
                >
                  {r.featuredImage && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.featuredImage}
                      alt={r.title}
                      className="w-full h-32 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="p-4">
                    <p className="font-medium text-sm line-clamp-2 group-hover:text-primary">
                      {r.title}
                    </p>
                    {r.readingTime && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {r.readingTime} min read
                      </p>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="max-w-3xl mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>
            Published by{" "}
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
