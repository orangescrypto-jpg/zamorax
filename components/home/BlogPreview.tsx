"use client"
import { useEffect, useState, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Clock, Tag, ChevronLeft, ChevronRight } from "lucide-react"
import { BlogService } from "@/src/services/blog"
import type { BlogPost } from "@/src/types/blog"

function formatDate(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleDateString("en-NG", {
    day: "numeric", month: "short", year: "numeric",
  })
}

function BlogCard({ post }: { post: BlogPost }) {
  return (
    <Link
      href={`/blog/${post.slug}`}
      className="group flex-shrink-0 w-64 sm:w-72 rounded-2xl overflow-hidden bg-secondary border border-white/5 hover:border-primary/30 transition-all hover:shadow-lg hover:shadow-primary/10 select-none"
    >
      {post.coverImage ? (
        <div className="relative h-40 overflow-hidden bg-white/5">
          <img
            src={post.coverImage}
            alt={post.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 pointer-events-none"
            onError={e => { (e.target as HTMLImageElement).style.display = "none" }}
          />
          <span className="absolute top-2 left-2 bg-primary/90 text-white text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wide">
            {post.category}
          </span>
        </div>
      ) : (
        <div className="h-40 bg-white/5 flex items-center justify-center">
          <Tag className="h-8 w-8 text-white/20" />
        </div>
      )}
      <div className="p-4 space-y-2">
        <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 group-hover:text-primary transition-colors">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="text-white/50 text-xs line-clamp-2">{post.excerpt}</p>
        )}
        <div className="flex items-center gap-1 text-white/40 text-xs pt-1">
          <Clock className="h-3 w-3" />
          <span>{formatDate(post.publishedAt)}</span>
        </div>
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return <div className="flex-shrink-0 w-64 sm:w-72 rounded-2xl bg-secondary border border-white/5 h-52 animate-pulse" />
}

export function BlogPreview() {
  const [posts, setPosts]     = useState<BlogPost[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError]     = useState<string | null>(null)

  const trackRef       = useRef<HTMLDivElement>(null)
  const isDragging     = useRef(false)
  const startX         = useRef(0)
  const scrollLeftRef  = useRef(0)
  const [canScrollLeft,  setCanScrollLeft]  = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(true)

  useEffect(() => {
    BlogService.getLatestPosts(6)
      .then(data => {
        if (process.env.NODE_ENV === "development") {
        }
        setPosts(data)
      })
      .catch(err => {
        // Surface the real Firestore error message so you can act on it
        const msg = err?.message ?? "query failed"
        console.error("[BlogPreview] fetch error:", msg, err)
        setError(msg)
      })
      .finally(() => setLoading(false))
  }, [])

  const updateArrows = () => {
    const el = trackRef.current
    if (!el) return
    setCanScrollLeft(el.scrollLeft > 0)
    setCanScrollRight(el.scrollLeft < el.scrollWidth - el.clientWidth - 4)
  }

  const onMouseDown = (e: React.MouseEvent) => {
    const el = trackRef.current; if (!el) return
    isDragging.current = true
    startX.current = e.pageX - el.offsetLeft
    scrollLeftRef.current = el.scrollLeft
    el.style.cursor = "grabbing"
  }
  const onMouseMove = (e: React.MouseEvent) => {
    if (!isDragging.current || !trackRef.current) return
    e.preventDefault()
    const x = e.pageX - trackRef.current.offsetLeft
    trackRef.current.scrollLeft = scrollLeftRef.current - (x - startX.current) * 1.2
    updateArrows()
  }
  const stopDrag = () => {
    isDragging.current = false
    if (trackRef.current) trackRef.current.style.cursor = "grab"
  }
  const onTouchStart = (e: React.TouchEvent) => {
    const el = trackRef.current; if (!el) return
    startX.current = e.touches[0].pageX
    scrollLeftRef.current = el.scrollLeft
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const el = trackRef.current; if (!el) return
    el.scrollLeft = scrollLeftRef.current + (startX.current - e.touches[0].pageX) * 1.1
    updateArrows()
  }
  const scrollBy = (dir: "left" | "right") => {
    trackRef.current?.scrollBy({ left: dir === "left" ? -280 : 280, behavior: "smooth" })
    setTimeout(updateArrows, 350)
  }

  // ── Always render the section shell so the heading + "View All" stays visible
  // even when there are no posts — this helps confirm the component is mounting.
  const showSkeleton = loading
  const showEmpty    = !loading && !error && posts.length === 0
  const showError    = !loading && !!error

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="w-1 h-5 bg-primary rounded-full" />
          <h2 className="text-white font-bold text-base">From Our Blog</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => scrollBy("left")}
            disabled={!canScrollLeft}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-white/60 hover:bg-primary hover:text-white transition-all disabled:opacity-20 disabled:pointer-events-none"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => scrollBy("right")}
            disabled={!canScrollRight}
            className="hidden md:flex items-center justify-center w-7 h-7 rounded-full bg-white/10 text-white/60 hover:bg-primary hover:text-white transition-all disabled:opacity-20 disabled:pointer-events-none"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
          <Link href="/blog" className="flex items-center gap-1 text-primary text-xs font-semibold hover:gap-2 transition-all">
            View All <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>

      {/* Error state — shows the real Firestore error so you know what to fix */}
      {showError && (
        <div className="rounded-xl bg-red-500/10 border border-red-500/20 px-4 py-3">
          <p className="text-red-400 text-xs font-medium">Failed to load posts</p>
          <p className="text-red-400/70 text-[11px] mt-0.5 break-all">{error}</p>
          <p className="text-white/40 text-[11px] mt-2">
            If the error mentions "index", go to your{" "}
            <span className="text-primary">Firebase Console → Firestore → Indexes</span>{" "}
            and create a composite index on <code className="text-primary">blogPosts</code>:{" "}
            <code className="text-white/60">status ASC, publishedAt DESC</code>
          </p>
        </div>
      )}

      {/* Empty state */}
      {showEmpty && (
        <p className="text-white/30 text-xs px-1">No blog posts published yet.</p>
      )}

      {/* Cards / skeletons */}
      {(showSkeleton || posts.length > 0) && (
        <div
          ref={trackRef}
          onScroll={updateArrows}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={stopDrag}
          onMouseLeave={stopDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          className="flex gap-4 overflow-x-auto pb-2 scroll-smooth no-scrollbar cursor-grab active:cursor-grabbing"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {showSkeleton
            ? [1, 2, 3].map(i => <SkeletonCard key={i} />)
            : posts.map(post => <BlogCard key={post.id} post={post} />)
          }
        </div>
      )}
    </section>
  )
}
