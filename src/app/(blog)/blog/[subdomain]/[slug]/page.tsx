import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, User, ArrowLeft, Tag, Share2 } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

interface Props {
  params: Promise<{ subdomain: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain, slug } = await params;

  const website = await prisma.website.findUnique({ where: { subdomain } });
  if (!website) return { title: "Post Not Found" };

  const post = await prisma.blogPost.findUnique({
    where: { websiteId_slug: { websiteId: website.id, slug } },
    select: {
      title: true,
      metaTitle: true,
      metaDescription: true,
      excerpt: true,
      focusKeyword: true,
      secondaryKeywords: true,
      featuredImage: true,
      featuredImageAlt: true,
      publishedAt: true,
    },
  });

  if (!post) return { title: "Post Not Found" };

  const title = post.metaTitle || post.title;
  const description = post.metaDescription || post.excerpt || "";
  const blogUrl = website.customDomain
    ? `https://${website.customDomain}/blog/${subdomain}/${slug}`
    : `${process.env.NEXTAUTH_URL || ""}/blog/${subdomain}/${slug}`;

  return {
    title,
    description,
    icons: website.faviconUrl
      ? { icon: website.faviconUrl, apple: website.faviconUrl }
      : undefined,
    keywords: [
      ...(post.focusKeyword ? [post.focusKeyword] : []),
      ...(post.secondaryKeywords || []),
    ],
    openGraph: {
      title,
      description,
      type: "article",
      url: blogUrl,
      siteName: website.brandName,
      publishedTime: post.publishedAt?.toISOString(),
      ...(post.featuredImage && {
        images: [
          {
            url: post.featuredImage,
            alt: post.featuredImageAlt || post.title,
            width: 1200,
            height: 630,
          },
        ],
      }),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(post.featuredImage && { images: [post.featuredImage] }),
    },
    alternates: {
      canonical: blogUrl,
    },
  };
}

export const revalidate = 3600;

export default async function PublicBlogPostPage({ params }: Props) {
  const { subdomain, slug } = await params;

  const website = await prisma.website.findUnique({ where: { subdomain } });
  if (!website) notFound();

  const post = await prisma.blogPost.findUnique({
    where: { websiteId_slug: { websiteId: website.id, slug } },
  });

  if (!post || post.status !== "PUBLISHED") notFound();

  // Increment views (non-blocking)
  prisma.blogPost
    .update({ where: { id: post.id }, data: { views: { increment: 1 } } })
    .catch(() => {});

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
      featuredImageAlt: true,
      readingTime: true,
      publishedAt: true,
      category: true,
    },
  });

  const brandColor = website.primaryColor || "#4F46E5";
  const readingTime = post.readingTime || Math.max(1, Math.ceil((post.content?.split(/\s+/).length || 0) / 200));
  const tags = post.tags || [];
  const baseUrl = process.env.NEXTAUTH_URL || "";
  const postUrl = `${baseUrl}/blog/${subdomain}/${slug}`;

  const cleanContent = post.content
    .replace(/^```(?:markdown|md|html|text)?\s*\n?/i, "")
    .replace(/\n?```\s*$/i, "")
    .replace(
      /\[INTERNAL_LINK:\s*([^\]]+)\]\(([^)]*)\)/gi,
      (_match, anchor: string) => anchor.trim()
    )
    .trim();

  const articleJsonLd = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.metaTitle || post.title,
    description: post.metaDescription || post.excerpt || "",
    author: {
      "@type": "Organization",
      name: website.brandName,
      url: website.brandUrl,
    },
    publisher: {
      "@type": "Organization",
      name: website.brandName,
      url: website.brandUrl,
      ...(website.logoUrl && {
        logo: { "@type": "ImageObject", url: website.logoUrl },
      }),
    },
    url: postUrl,
    datePublished: post.publishedAt?.toISOString(),
    dateModified: post.updatedAt?.toISOString(),
    mainEntityOfPage: postUrl,
    ...(post.featuredImage && {
      image: {
        "@type": "ImageObject",
        url: post.featuredImage,
        caption: post.featuredImageAlt || post.title,
      },
    }),
    ...(tags.length > 0 && { keywords: tags.join(", ") }),
    wordCount: post.wordCount || cleanContent.split(/\s+/).length,
    articleSection: post.category || website.niche,
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: website.brandName, item: website.brandUrl },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${baseUrl}/blog/${subdomain}` },
      { "@type": "ListItem", position: 3, name: post.title, item: postUrl },
    ],
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />

      {/* Sticky Header */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            href={`/blog/${subdomain}`}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            {website.brandName} Blog
          </Link>
          <a
            href={website.brandUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {website.domain} ↗
          </a>
        </div>
      </nav>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Category */}
        {post.category && (
          <span
            className="text-sm font-medium px-3 py-1 rounded-full"
            style={{ backgroundColor: `${brandColor}14`, color: brandColor }}
          >
            {post.category}
          </span>
        )}

        {/* Title */}
        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mt-4 mb-4 leading-tight tracking-tight">
          {post.title}
        </h1>

        {/* Excerpt */}
        {post.excerpt && (
          <p className="text-lg text-muted-foreground leading-relaxed mb-2">
            {post.excerpt}
          </p>
        )}

        {/* Meta */}
        <div className="flex items-center gap-4 mt-4 mb-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            {website.brandName}
          </span>
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              {new Date(post.publishedAt).toLocaleDateString("en-US", {
                month: "long",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {readingTime} min read
          </span>
        </div>

        {/* Featured Image */}
        {post.featuredImage && (
          /* eslint-disable-next-line @next/next/no-img-element */
          <img
            src={post.featuredImage}
            alt={post.featuredImageAlt || post.title}
            className="w-full rounded-2xl object-cover max-h-[500px] mb-10"
          />
        )}

        {/* Content - proper markdown rendering */}
        <div className="prose prose-slate prose-lg max-w-none prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-blockquote:border-l-primary/30 prose-blockquote:text-muted-foreground [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap sm:[&_table]:table sm:[&_table]:whitespace-normal [&_th]:bg-slate-100 [&_th]:border [&_th]:border-slate-300 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-sm [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_table]:border-collapse [&_table]:w-full [&_table]:text-base sm:[&_th]:px-4 sm:[&_td]:px-4 sm:[&_th]:text-base sm:[&_td]:text-base">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            rehypePlugins={[
              [
                rehypeSanitize,
                {
                  ...defaultSchema,
                  tagNames: [
                    ...(defaultSchema.tagNames || []),
                    "table", "thead", "tbody", "tr", "th", "td",
                    "details", "summary",
                  ],
                  attributes: {
                    ...defaultSchema.attributes,
                    "*": [...(defaultSchema.attributes?.["*"] || []), "className", "class"],
                    a: [...(defaultSchema.attributes?.a || []), "href", "title", "target", "rel"],
                    img: [...(defaultSchema.attributes?.img || []), "src", "alt", "title", "width", "height"],
                  },
                },
              ],
              rehypeSlug,
            ]}
          >
            {cleanContent}
          </ReactMarkdown>
        </div>

        {/* Tags */}
        {tags.length > 0 && (
          <div className="mt-12 pt-8 border-t flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Share + CTA */}
        <div className="mt-10 pt-6 border-t flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Found this helpful?</p>
            <p className="text-xs text-muted-foreground">Share it with your network</p>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(postUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> Tweet
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> LinkedIn
            </a>
          </div>
        </div>

        {/* Brand CTA */}
        <div
          className="mt-10 p-8 rounded-2xl text-center"
          style={{ background: `linear-gradient(135deg, ${brandColor}, ${brandColor}dd)` }}
        >
          <h2 className="text-2xl font-bold text-white mb-2">
            Ready to try {website.brandName}?
          </h2>
          <p className="text-white/80 mb-6">{website.description}</p>
          <a
            href={website.brandUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors"
            style={{ color: brandColor }}
          >
            Visit {website.brandName}
          </a>
        </div>
      </article>

      {/* Related Posts */}
      {related.length > 0 && (
        <div className="border-t py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold mb-6">Related Articles</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/blog/${subdomain}/${r.slug}`}
                  className="group block border rounded-2xl overflow-hidden hover:shadow-lg transition-all"
                >
                  {r.featuredImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.featuredImage}
                      alt={r.featuredImageAlt || r.title}
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="p-4">
                    {r.category && (
                      <span className="text-xs font-medium text-muted-foreground">
                        {r.category}
                      </span>
                    )}
                    <p className="font-semibold text-sm line-clamp-2 group-hover:text-primary mt-1">
                      {r.title}
                    </p>
                    {r.readingTime && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {r.readingTime} min read
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
      <footer className="border-t bg-slate-50 py-8">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()}{" "}
            <a href={website.brandUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              {website.brandName}
            </a>
          </p>
          <div className="flex gap-4">
            <Link href={`/blog/${subdomain}`} className="hover:text-foreground">
              Blog
            </Link>
            <a href={website.brandUrl} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">
              Website
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
