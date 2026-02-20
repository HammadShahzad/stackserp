import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Clock, ArrowRight } from "lucide-react";

interface Props {
  params: Promise<{ subdomain: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { subdomain } = await params;
  const website = await prisma.website.findUnique({ where: { subdomain } });

  if (!website) return { title: "Blog Not Found" };

  const baseUrl = process.env.NEXTAUTH_URL || "";
  const blogUrl = `${baseUrl}/blog/${subdomain}`;

  return {
    title: `${website.brandName} Blog - ${website.niche}`,
    description: `Expert advice and insights from ${website.brandName}. ${website.description}`,
    openGraph: {
      title: `${website.brandName} Blog`,
      description: website.description,
      url: blogUrl,
      siteName: website.brandName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${website.brandName} Blog`,
      description: website.description,
    },
    alternates: {
      canonical: blogUrl,
    },
  };
}

export const revalidate = 3600;

export default async function PublicBlogListPage({ params }: Props) {
  const { subdomain } = await params;

  const website = await prisma.website.findUnique({ where: { subdomain } });
  if (!website) notFound();

  const posts = await prisma.blogPost.findMany({
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

  const brandColor = website.primaryColor || "#4F46E5";
  const baseUrl = process.env.NEXTAUTH_URL || "";
  const blogUrl = `${baseUrl}/blog/${subdomain}`;

  const collectionJsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: `${website.brandName} Blog`,
    description: website.description,
    url: blogUrl,
    publisher: {
      "@type": "Organization",
      name: website.brandName,
      url: website.brandUrl,
      ...(website.logoUrl && {
        logo: { "@type": "ImageObject", url: website.logoUrl },
      }),
    },
  };

  return (
    <div className="min-h-screen bg-white">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(collectionJsonLd) }}
      />

      {/* Sticky Nav */}
      <nav className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between">
          <Link
            href={`/blog/${subdomain}`}
            className="font-bold text-foreground"
          >
            {website.brandName}
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

      {/* Hero */}
      <div className="bg-gradient-to-b from-slate-50 to-white border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12 text-center">
          <h1 className="text-4xl font-bold text-foreground mb-3">Blog</h1>
          <p className="text-lg text-muted-foreground max-w-xl mx-auto">
            {website.description}
          </p>
        </div>
      </div>

      {/* Posts */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {posts.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground">
            <p className="text-lg font-medium">No blog posts yet.</p>
            <p className="text-sm mt-1">Check back soon!</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {posts.map((post) => {
              const rt = post.readingTime || Math.max(1, Math.ceil((post.content?.split(/\s+/).length || 0) / 200));
              return (
                <Link
                  key={post.id}
                  href={`/blog/${subdomain}/${post.slug}`}
                  className="group rounded-2xl border bg-white hover:shadow-lg transition-all overflow-hidden flex flex-col"
                >
                  {post.featuredImage && (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={post.featuredImage}
                      alt={post.featuredImageAlt || post.title}
                      className="w-full h-48 object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  )}
                  <div className="p-6 flex-1 flex flex-col">
                    <div className="flex items-center gap-2 mb-3">
                      {post.category && (
                        <span
                          className="text-xs font-medium px-2 py-0.5 rounded-full"
                          style={{
                            backgroundColor: `${brandColor}14`,
                            color: brandColor,
                          }}
                        >
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
                      <span>{website.brandName}</span>
                      {post.publishedAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {new Date(post.publishedAt).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })}
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

      {/* Footer */}
      <footer className="border-t bg-slate-50 py-8 mt-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 flex items-center justify-between text-sm text-muted-foreground">
          <p>
            &copy; {new Date().getFullYear()}{" "}
            <a
              href={website.brandUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-foreground"
            >
              {website.brandName}
            </a>
          </p>
          <p>
            Powered by{" "}
            <a href="https://stackserp.com" className="hover:text-foreground">
              StackSerp
            </a>
          </p>
        </div>
      </footer>
    </div>
  );
}
