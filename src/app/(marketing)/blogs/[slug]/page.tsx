import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, User, ArrowLeft, Tag, Share2, ChevronRight, ArrowRight } from "lucide-react";
import { Logo } from "@/components/ui/logo";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeSanitize, { defaultSchema } from "rehype-sanitize";

const STACKSERP_SUBDOMAIN = "stackserp";

interface Props {
  params: Promise<{ slug: string }>;
}

function extractFAQs(content: string): { question: string; answer: string }[] {
  const faqs: { question: string; answer: string }[] = [];
  const faqSectionMatch = content.match(/##\s*(?:FAQ|Frequently Asked Questions)[^\n]*\n([\s\S]*?)(?=\n##\s[^#]|\n---|\Z)/i);
  if (!faqSectionMatch) return faqs;

  const faqContent = faqSectionMatch[1];
  const questionBlocks = faqContent.split(/###\s+/).filter(Boolean);

  for (const block of questionBlocks) {
    const lines = block.trim().split("\n");
    const question = lines[0]?.replace(/\*\*/g, "").replace(/\??\s*$/, "?").trim();
    const answer = lines.slice(1).join(" ").replace(/[#*_`]/g, "").trim();
    if (question && answer && answer.length > 10) {
      faqs.push({ question, answer: answer.substring(0, 500) });
    }
  }
  return faqs.slice(0, 8);
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const baseUrl = process.env.NEXTAUTH_URL || "https://stackserp.com";

  const website = await prisma.website.findUnique({ where: { subdomain: STACKSERP_SUBDOMAIN } });
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
  const postUrl = `${baseUrl}/blogs/${slug}`;

  return {
    title: `${title} | StackSerp Blog`,
    description,
    keywords: [
      ...(post.focusKeyword ? [post.focusKeyword] : []),
      ...(post.secondaryKeywords || []),
    ],
    openGraph: {
      title,
      description,
      type: "article",
      url: postUrl,
      siteName: "StackSerp",
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
      canonical: postUrl,
    },
  };
}

export const revalidate = 60;

export default async function StackSerpBlogPostPage({ params }: Props) {
  const { slug } = await params;
  const baseUrl = process.env.NEXTAUTH_URL || "https://stackserp.com";

  const website = await prisma.website.findUnique({ where: { subdomain: STACKSERP_SUBDOMAIN } });
  if (!website) notFound();

  const post = await prisma.blogPost.findUnique({
    where: { websiteId_slug: { websiteId: website.id, slug } },
    include: { keyword: { select: { parentCluster: true } } },
  });

  if (!post || post.status !== "PUBLISHED") notFound();

  prisma.blogPost
    .update({ where: { id: post.id }, data: { views: { increment: 1 } } })
    .catch(() => {});

  const clusterName = post.keyword?.parentCluster;

  const relatedSelect = {
    id: true,
    title: true,
    slug: true,
    excerpt: true,
    featuredImage: true,
    featuredImageAlt: true,
    readingTime: true,
    publishedAt: true,
    category: true,
  } as const;

  let related = await prisma.blogPost.findMany({
    where: {
      websiteId: website.id,
      status: "PUBLISHED",
      id: { not: post.id },
      ...(clusterName ? { keyword: { parentCluster: clusterName } } : {}),
    },
    orderBy: { publishedAt: "desc" },
    take: 9,
    select: relatedSelect,
  });

  if (related.length < 9) {
    const existingIds = [post.id, ...related.map(r => r.id)];
    const moreRelated = await prisma.blogPost.findMany({
      where: {
        websiteId: website.id,
        status: "PUBLISHED",
        id: { notIn: existingIds },
        ...(post.category ? { category: post.category } : {}),
      },
      orderBy: { publishedAt: "desc" },
      take: 9 - related.length,
      select: relatedSelect,
    });
    related = [...related, ...moreRelated];
  }

  if (related.length < 9) {
    const existingIds = [post.id, ...related.map(r => r.id)];
    const moreRecent = await prisma.blogPost.findMany({
      where: {
        websiteId: website.id,
        status: "PUBLISHED",
        id: { notIn: existingIds },
      },
      orderBy: { publishedAt: "desc" },
      take: 9 - related.length,
      select: relatedSelect,
    });
    related = [...related, ...moreRecent];
  }

  const readingTime = post.readingTime || Math.max(1, Math.ceil((post.content?.split(/\s+/).length || 0) / 200));
  const tags = post.tags || [];
  const postUrl = `${baseUrl}/blogs/${slug}`;

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
      name: "StackSerp",
      url: "https://stackserp.com",
    },
    publisher: {
      "@type": "Organization",
      name: "StackSerp",
      url: "https://stackserp.com",
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
    articleSection: post.category || "SEO",
  };

  const breadcrumbJsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "StackSerp", item: "https://stackserp.com" },
      { "@type": "ListItem", position: 2, name: "Blog", item: `${baseUrl}/blogs` },
      ...(post.category
        ? [{ "@type": "ListItem", position: 3, name: post.category, item: `${baseUrl}/blogs` }]
        : []),
      { "@type": "ListItem", position: post.category ? 4 : 3, name: post.title, item: postUrl },
    ],
  };

  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "StackSerp",
    url: "https://stackserp.com",
    description: "AI-powered blog generation and SEO automation platform",
  };

  const faqs = extractFAQs(cleanContent);
  const faqJsonLd = faqs.length > 0 ? {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map(faq => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  } : null;

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationJsonLd) }}
      />
      {faqJsonLd && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      )}

      {/* Nav */}
      {/* Breadcrumbs */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
        <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-sm text-muted-foreground">
          <Link href="/" className="hover:text-foreground transition-colors">
            StackSerp
          </Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/blogs" className="hover:text-foreground transition-colors">
            Blog
          </Link>
          {post.category && (
            <>
              <ChevronRight className="h-3 w-3" />
              <span className="text-muted-foreground">{post.category}</span>
            </>
          )}
          <ChevronRight className="h-3 w-3" />
          <span className="text-foreground font-medium truncate max-w-[200px]">{post.title}</span>
        </nav>
      </div>

      {/* Article */}
      <article className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {post.category && (
          <span className="text-sm font-medium px-3 py-1 rounded-full bg-primary/10 text-primary">
            {post.category}
          </span>
        )}

        <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mt-4 mb-4 leading-tight tracking-tight">
          {post.title}
        </h1>

        {post.excerpt && (
          <p className="text-lg text-muted-foreground leading-relaxed mb-2">
            {post.excerpt}
          </p>
        )}

        <div className="flex items-center gap-4 mt-4 mb-8 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <User className="h-4 w-4" />
            StackSerp
          </span>
          {post.publishedAt && (
            <span className="flex items-center gap-1.5">
              <Calendar className="h-4 w-4" />
              <time dateTime={post.publishedAt.toISOString()}>
                {new Date(post.publishedAt).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </time>
            </span>
          )}
          <span className="flex items-center gap-1.5">
            <Clock className="h-4 w-4" />
            {readingTime} min read
          </span>
        </div>

        {post.featuredImage && (
          <figure className="mb-10">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={post.featuredImage}
              alt={post.featuredImageAlt || post.title}
              className="w-full rounded-2xl object-cover max-h-[500px]"
              loading="eager"
              width={1200}
              height={630}
            />
            {post.featuredImageAlt && (
              <figcaption className="text-center text-xs text-muted-foreground mt-2">
                {post.featuredImageAlt}
              </figcaption>
            )}
          </figure>
        )}

        <section className="prose prose-slate prose-lg max-w-none prose-headings:tracking-tight prose-h1:text-3xl prose-h2:text-2xl prose-h3:text-xl prose-a:text-primary prose-a:no-underline hover:prose-a:underline prose-img:rounded-xl prose-pre:bg-slate-900 prose-pre:text-slate-100 prose-blockquote:border-l-primary/30 prose-blockquote:text-muted-foreground [&_table]:block [&_table]:overflow-x-auto [&_table]:whitespace-nowrap sm:[&_table]:table sm:[&_table]:whitespace-normal [&_th]:bg-slate-100 [&_th]:border [&_th]:border-slate-300 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:font-semibold [&_th]:text-sm [&_td]:border [&_td]:border-slate-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_table]:border-collapse [&_table]:w-full [&_table]:text-base sm:[&_th]:px-4 sm:[&_td]:px-4 sm:[&_th]:text-base sm:[&_td]:text-base">
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
                    img: [...(defaultSchema.attributes?.img || []), "src", "alt", "title", "width", "height", "loading"],
                  },
                },
              ],
              rehypeSlug,
            ]}
          >
            {cleanContent}
          </ReactMarkdown>
        </section>

        {tags.length > 0 && (
          <aside className="mt-12 pt-8 border-t flex items-center gap-2 flex-wrap">
            <Tag className="h-4 w-4 text-muted-foreground" />
            {tags.map((tag) => (
              <span
                key={tag}
                className="text-xs bg-muted px-2.5 py-1 rounded-full text-muted-foreground"
              >
                {tag}
              </span>
            ))}
          </aside>
        )}

        {/* Author Box */}
        <aside className="mt-10 p-6 bg-slate-50 rounded-2xl border flex items-start gap-4">
          <div className="w-14 h-14 rounded-full flex items-center justify-center bg-primary text-primary-foreground flex-shrink-0">
            <Logo className="h-7 w-7" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">StackSerp</p>
            <p className="text-sm text-muted-foreground mt-1">
              AI-powered blog generation and SEO automation platform. Generate high-quality,
              SEO-optimized content in minutes.
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Link
                href="/"
                className="text-sm font-medium text-primary hover:underline"
              >
                Visit StackSerp
              </Link>
              <Link
                href="/blogs"
                className="text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                More Articles
              </Link>
            </div>
          </div>
        </aside>

        {/* Share */}
        <div className="mt-10 pt-6 border-t flex items-center justify-between">
          <div>
            <p className="text-sm font-medium">Found this helpful?</p>
            <p className="text-xs text-muted-foreground">Share it with your network</p>
          </div>
          <div className="flex gap-2">
            <a
              href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(postUrl)}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> Tweet
            </a>
            <a
              href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(postUrl)}`}
              target="_blank"
              rel="noopener noreferrer nofollow"
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border hover:bg-muted transition-colors"
            >
              <Share2 className="h-3.5 w-3.5" /> LinkedIn
            </a>
          </div>
        </div>

        {/* CTA */}
        <div className="mt-10 p-8 rounded-2xl text-center bg-gradient-to-r from-primary to-purple-600">
          <h2 className="text-2xl font-bold text-white mb-2">
            Ready to automate your SEO content?
          </h2>
          <p className="text-white/80 mb-6">
            Generate high-quality blog posts in minutes, not hours.
          </p>
          <Link
            href="/register"
            className="inline-flex items-center gap-2 bg-white text-primary font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-colors"
          >
            Start for Free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </article>

      {/* Related Posts */}
      {related.length > 0 && (
        <section className="border-t py-12">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-xl font-bold mb-6">Related Articles</h2>
            <div className="grid gap-6 md:grid-cols-3">
              {related.map((r) => (
                <Link
                  key={r.id}
                  href={`/blogs/${r.slug}`}
                  className="group block border rounded-2xl overflow-hidden hover:shadow-lg transition-all"
                >
                  {r.featuredImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={r.featuredImage}
                      alt={r.featuredImageAlt || r.title}
                      className="w-full h-40 object-cover group-hover:scale-105 transition-transform duration-300"
                      loading="lazy"
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
        </section>
      )}
    </>
  );
}
