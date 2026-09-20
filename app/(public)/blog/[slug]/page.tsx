// app/(public)/blog/[slug]/page.tsx
// SERVER component: Google receives the full article HTML, per-post
// <title>/description/canonical, and Article JSON-LD on the first response.
// (Previously this was a "use client" page that fetched in useEffect, so the
// crawler only ever saw a loading skeleton and the site-wide default title.)

import type { Metadata } from "next"
import Link from "next/link"
import { notFound } from "next/navigation"
import { ArrowLeft, Clock, Tag, User } from "lucide-react"
import { BlogService } from "@/src/services/blog"
import { blogCoverImage } from "@/constants/blog"
import { BlogPostExtras } from "./BlogPostExtras"

export const revalidate = 600 // re-render published posts at most every 10 min

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "https://zamorax.com"

interface Props {
  params: Promise<{ slug: string }>
}

async function getPost(slug: string) {
  try {
    return await BlogService.getPostBySlug(slug) // published only
  } catch {
    return null
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "long", year: "numeric",
  })
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)

  if (!post) {
    return { title: "Post not found", robots: { index: false, follow: false } }
  }

  const url = `${BASE}/blog/${post.slug}`
  const description =
    post.excerpt?.trim() ||
    post.content.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 155)
  const image = blogCoverImage(post.coverImage)
  const imageUrl = image.startsWith("http") ? image : `${BASE}${image}`

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      type: "article",
      url,
      title: post.title,
      description,
      siteName: "Zamorax",
      locale: "en_NG",
      images: [{ url: imageUrl, alt: post.title }],
      publishedTime: post.publishedAt ?? undefined,
      modifiedTime: post.updatedAt,
      authors: post.authorName ? [post.authorName] : undefined,
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [imageUrl],
      site: "@zamoraxng",
    },
  }
}

export default async function BlogPostPage({ params }: Props) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound() // real HTTP 404 instead of a soft-404 "not found" box

  const url = `${BASE}/blog/${post.slug}`
  const image = blogCoverImage(post.coverImage)

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt || undefined,
    image: [image.startsWith("http") ? image : `${BASE}${image}`],
    datePublished: post.publishedAt ?? post.createdAt,
    dateModified: post.updatedAt,
    mainEntityOfPage: { "@type": "WebPage", "@id": url },
    author: { "@type": "Person", name: post.authorName || "Zamorax" },
    publisher: {
      "@type": "Organization",
      name: "Zamorax",
      logo: { "@type": "ImageObject", url: `${BASE}/icon-512.svg` },
    },
  }

  return (
    <main className="container py-8 max-w-3xl mx-auto space-y-8">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />

      <Link
        href="/blog"
        className="inline-flex items-center gap-1.5 text-gray-400 hover:text-gray-900 text-sm transition-colors"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Blog
      </Link>

      <article className="space-y-6">
        {post.category && (
          <span className="inline-block bg-primary/20 text-primary text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wide">
            {post.category}
          </span>
        )}

        <h1 className="text-2xl md:text-3xl font-extrabold text-gray-900 leading-tight">
          {post.title}
        </h1>

        <div className="flex flex-wrap items-center gap-4 text-gray-400 text-xs border-b border-gray-100 pb-5">
          {post.authorName && (
            <span className="flex items-center gap-1.5"><User className="h-3.5 w-3.5" />{post.authorName}</span>
          )}
          {post.publishedAt && (
            <time dateTime={post.publishedAt} className="flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" />{formatDate(post.publishedAt)}
            </time>
          )}
          {/* Live view count + view-increment live in the client component */}
          <BlogPostExtras postId={post.id} category={post.category} initialViews={post.views ?? 0} part="views" />
        </div>

        <div className="rounded-2xl overflow-hidden h-64 md:h-80 bg-gray-100">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={image} alt={post.title} className="w-full h-full object-cover" />
        </div>

        {post.excerpt && (
          <p className="text-gray-500 text-base leading-relaxed italic border-l-2 border-primary pl-4">
            {post.excerpt}
          </p>
        )}

        {post.content ? (
          <div
            className="blog-content text-gray-700 leading-relaxed"
            style={{ fontSize: "15px", lineHeight: "1.8" }}
            dangerouslySetInnerHTML={{ __html: post.content }}
          />
        ) : (
          <p className="text-gray-300 italic text-sm">No content available.</p>
        )}

        {post.tags?.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
            <Tag className="h-4 w-4 text-gray-300 mt-0.5" />
            {post.tags.map(tag => (
              <Link
                key={tag}
                href={`/blog?tag=${encodeURIComponent(tag)}`}
                className="text-xs bg-gray-100 hover:bg-gray-200 text-gray-500 hover:text-gray-900 px-3 py-1 rounded-full transition-colors"
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}
      </article>

      <BlogPostExtras postId={post.id} category={post.category} initialViews={post.views ?? 0} part="related" />
    </main>
  )
}
