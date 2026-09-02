"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { notFound, useParams } from "next/navigation"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import Link from "next/link"
import { ArrowLeft, Calendar, Clock, Share2, ExternalLink, ChevronRight } from "lucide-react"
import { blogApi, Blog, formatDate, getImageUrl } from "@/lib/api"

export default function BlogPostPage() {
  const routeParams = useParams<{ id: string }>()
  const id = routeParams?.id

  const [blog, setBlog] = useState<Blog | null>(null)
  const [relatedBlogs, setRelatedBlogs] = useState<Blog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [readingProgress, setReadingProgress] = useState(0)

  useEffect(() => {
    const fetchBlog = async () => {
      if (!id || id === "undefined") {
        setError("Invalid article link")
        setLoading(false)
        return
      }
      try {
        setLoading(true)
        setError(null)

        const blogData = await blogApi.getBlog(id)
        setBlog(blogData)

        const related = await blogApi.getBlogsByCategory(blogData.category, 4)
        setRelatedBlogs(related.filter(b => b.id !== blogData.id).slice(0, 2))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch blog')
      } finally {
        setLoading(false)
      }
    }

    fetchBlog()
  }, [id])

  // Reading progress tracking
  useEffect(() => {
    const updateReadingProgress = () => {
      const article = document.querySelector('article')
      if (!article) return

      const scrollTop = window.scrollY
      const docHeight = article.offsetHeight
      const winHeight = window.innerHeight
      const scrollPercent = scrollTop / (docHeight - winHeight)
      const scrollPercentRounded = Math.round(scrollPercent * 100)
      
      setReadingProgress(Math.min(100, Math.max(0, scrollPercentRounded)))
    }

    window.addEventListener('scroll', updateReadingProgress)
    return () => window.removeEventListener('scroll', updateReadingProgress)
  }, [blog])

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: blog?.title,
          text: blog?.excerpt,
          url: window.location.href,
        })
      } catch (error) {
        console.log('Error sharing:', error)
      }
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(window.location.href)
      alert('Link copied to clipboard!')
    }
  }

  const cleanContent = (content: string) => {
    // Remove common unwanted patterns from scraped content
    let cleanedContent = content
      // Remove social media sharing buttons text
      .replace(/Share on Facebook|Share on Twitter|Share on LinkedIn/gi, '')
      // Remove cookie notices
      .replace(/This website uses cookies|We use cookies/gi, '')
      // Remove newsletter signup text
      .replace(/Subscribe to our newsletter|Sign up for updates/gi, '')
      // Remove advertisement text
      .replace(/Advertisement|Sponsored Content|ADVERTISEMENT/gi, '')
      // Remove "Read more" links
      .replace(/Read more:|Continue reading|Click here to read more/gi, '')
      // Remove author bylines that are redundant
      .replace(/By\s+[A-Za-z\s]+\s*\|\s*/gi, '')
      // Remove timestamp patterns
      .replace(/\d{1,2}\/\d{1,2}\/\d{4}\s*\|\s*/gi, '')
      .replace(/\d{1,2}:\d{2}\s*(AM|PM)\s*/gi, '')
      // Remove social sharing counts
      .replace(/\d+\s*(shares?|likes?|comments?)/gi, '')
      // Remove extra whitespace and normalize line breaks
      .replace(/\n{3,}/g, '\n\n')
      .trim()

    return cleanedContent
  }

  const formatContent = (content: string) => {
    // Sanitize any placeholder caption text
    const sanitizedContent = content
      .replace(/<figcaption[^>]*>\s*Click here to add image caption\.{0,3}\s*<\/figcaption>/gi, '')
      .replace(/<figcaption[^>]*>\s*Click here to add caption\.{0,3}\s*<\/figcaption>/gi, '')
      .replace(/<figcaption[^>]*>\s*<\/figcaption>/gi, '')

    // If the content is rich HTML (from our text editor), render it directly
    const isHtml = /<[a-z][\s\S]*>/i.test(sanitizedContent)
    if (isHtml) {
      return (
        <div 
          className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-6 blog-content"
          dangerouslySetInnerHTML={{ __html: sanitizedContent }}
        />
      )
    }

    // First clean the content
    const cleaned = cleanContent(content)
    const sections = cleaned.split('\n\n').filter(section => {
      const trimmed = section.trim()
      // Filter out very short sections that are likely metadata
      return trimmed.length > 20 && 
             !trimmed.match(/^\d+$/) && // Just numbers
             !trimmed.match(/^(Tags?|Categories?):?/i) && // Tag/category labels
             !trimmed.match(/^(Source|Via):?/i) // Source labels
    })

    // Handle inline formatting
    const formatInlineContent = (text: string) => {
      // Bold text
      text = text.replace(/\*\*(.*?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
      
      // Italic text  
      text = text.replace(/\*(.*?)\*/g, '<em class="italic">$1</em>')
      
      // Links - but filter out common unwanted links
      text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, linkText, url) => {
        // Skip common unwanted link patterns
        if (linkText.match(/share|subscribe|newsletter|advertisement/i) || 
            url.match(/facebook\.com|twitter\.com|linkedin\.com|instagram\.com/)) {
          return linkText // Return just the text without the link
        }
        return `<a href="${url}" class="text-blue-600 hover:text-blue-800 underline decoration-2 underline-offset-2 transition-colors" target="_blank" rel="noopener noreferrer">${linkText}</a>`
      })
      
      return text
    }
    
    return sections.map((section, index) => {
      const trimmed = section.trim()
      
      // Main headings
      if (trimmed.startsWith('## ') || (trimmed.length < 100 && trimmed.match(/^[A-Z][^.!?]*$/))) {
        const headingText = trimmed.startsWith('## ') ? trimmed.replace('## ', '') : trimmed
        return (
          <h2 key={index} className="font-serif text-2xl md:text-3xl font-bold text-gray-900 mt-12 mb-6 leading-tight">
            {headingText}
          </h2>
        )
      }
      
      // Sub headings
      if (trimmed.startsWith('### ')) {
        return (
          <h3 key={index} className="font-serif text-xl md:text-2xl font-semibold text-gray-800 mt-8 mb-4 leading-tight">
            {trimmed.replace('### ', '')}
          </h3>
        )
      }
      
      // Blockquotes (Markdown > syntax)
      if (trimmed.startsWith('> ') || trimmed.startsWith('>')) {
        const quoteText = trimmed.replace(/^>\s*/, '')
        return (
          <blockquote key={index} className="border-l-4 border-blue-500 bg-blue-50/40 py-3 px-5 rounded-r-lg my-6 text-gray-700 italic text-lg leading-relaxed blog-quote">
            <p dangerouslySetInnerHTML={{ __html: formatInlineContent(quoteText) }} />
          </blockquote>
        )
      }

      // Markdown images (![alt](url))
      if (trimmed.startsWith('![') && trimmed.includes('](')) {
        const match = trimmed.match(/!\[(.*?)\]\((.*?)\)/)
        if (match) {
          return (
            <div key={index} className="my-8 rounded-lg overflow-hidden shadow-md">
              <img src={getImageUrl(match[2])} alt={match[1] || "Article image"} className="w-full max-h-[500px] object-cover rounded-lg" />
              {match[1] && <p className="text-xs text-center text-gray-500 mt-2">{match[1]}</p>}
            </div>
          )
        }
      }

      // Bullet lists
      if (trimmed.includes('\n- ') || trimmed.startsWith('- ')) {
        const listItems = trimmed.split('\n').filter(item => item.trim().startsWith('- '))
        return (
          <ul key={index} className="space-y-3 my-6 ml-4">
            {listItems.map((item, i) => (
              <li key={i} className="flex items-start gap-3 text-gray-700 leading-relaxed text-lg">
                <div className="shrink-0 w-2 h-2 bg-blue-500 rounded-full mt-3"></div>
                <span>{item.replace('- ', '')}</span>
              </li>
            ))}
          </ul>
        )
      }
      
      // Regular paragraphs - filter out very short or metadata-like content
      if (trimmed.length > 30 && !trimmed.match(/^(Photo|Image|Credit|Source):/i)) {
        return (
          <p 
            key={index} 
            className="text-gray-700 leading-relaxed mb-6 text-lg"
            dangerouslySetInnerHTML={{ __html: formatInlineContent(trimmed) }}
          />
        )
      }
      
      return null
    }).filter(Boolean) // Remove null entries
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        <div className="flex-1 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
            <div className="bg-red-50 border border-red-200 rounded-lg p-8">
              <h1 className="text-2xl font-bold text-red-900 mb-4">Unable to Load Article</h1>
              <p className="text-red-700 mb-8">{error}</p>
              <Button asChild variant="outline">
                <Link href="/blog" className="text-red-700 border-red-300 hover:bg-red-50">
                  Back to Blog
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-gray-50">
        
        <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-50">
          <div className="h-full bg-blue-500 transition-all duration-300" style={{ width: '0%' }} />
        </div>
        
        <div className="flex-1">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <Skeleton className="h-10 w-32" />
          </div>

          <article className="bg-white">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="mb-8">
                <Skeleton className="h-16 w-full mb-4" />
                <Skeleton className="h-6 w-full mb-2" />
                <Skeleton className="h-6 w-2/3 mb-8" />
              </div>

              <div className="flex items-center justify-between mb-8 pb-8 border-b">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div>
                    <Skeleton className="h-4 w-32 mb-2" />
                    <Skeleton className="h-4 w-24" />
                  </div>
                </div>
              </div>

              <Skeleton className="h-64 w-full mb-12" />

              <div className="space-y-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-4 w-full" />
                ))}
              </div>
            </div>
          </article>
        </div>

      </div>
    )
  }

  if (!blog) {
    notFound()
  }

  return (
    <div className="flex flex-col min-h-screen bg-gray-50">

      {/* Reading Progress Bar */}
      <div className="fixed top-0 left-0 w-full h-1 bg-gray-200 z-50">
        <div 
          className="h-full bg-blue-500 transition-all duration-300" 
          style={{ width: `${readingProgress}%` }} 
        />
      </div>

      <div className="flex-1">
        {/* Back Button */}
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <Button variant="ghost" asChild className="mb-4 hover:bg-white hover:shadow-md transition-all duration-200">
            <Link href="/blog" className="flex items-center gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Blog
            </Link>
          </Button>
        </div>

        {/* Article */}
        <article className="bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {/* Minimal Header */}
            <header className="mb-12">            
              <h1 className="font-serif text-3xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                {blog.title}
              </h1>
              
              {blog.excerpt && (
                <p className="text-xl text-gray-600 leading-relaxed mb-8 font-light">
                  {blog.excerpt}
                </p>
              )}
            </header>

            {/* Minimal Author Info */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-6 border-b gap-4">
              <div className="flex items-center gap-4">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={blog.author_avatar || "/placeholder.svg"} alt={blog.author} />
                  <AvatarFallback className="bg-blue-100 text-blue-800 font-semibold">
                    {blog.author
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-medium text-gray-900">{blog.author}</div>
                  <div className="flex items-center gap-3 text-sm text-gray-600">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      {formatDate(blog.created_at)}
                    </div>
                    {blog.read_time && (
                      <div className="flex items-center gap-1">
                        <Clock className="h-4 w-4" />
                        {blog.read_time}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleShare} className="hover:bg-blue-50 transition-colors">
                  <Share2 className="h-4 w-4 mr-1" />
                  Share
                </Button>
                {blog.source_url && (
                  <Button asChild variant="outline" size="sm" className="hover:bg-blue-50 transition-colors">
                    <a href={blog.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                      <ExternalLink className="h-4 w-4" />
                      Source
                    </a>
                  </Button>
                )}
              </div>
            </div>

            {/* Featured Image */}
            {blog.image && (
              <div className="mb-12">
                <img
                  src={getImageUrl(blog.image)}
                  alt={blog.title}
                  className="w-full h-64 md:h-96 object-cover rounded-lg shadow-md"
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            {/* Clean Article Content */}
            <div className="max-w-none mb-12 text-justify">
              {formatContent(blog.content)}
            </div>

            {/* Related Posts - Only if available */}
            {relatedBlogs.length > 0 && (
              <>
                <Separator className="mb-8" />
                <section>
                  <h3 className="font-serif text-2xl font-bold text-gray-900 mb-6">Related Articles</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {relatedBlogs.map((relatedBlog) => (
                      <Card key={relatedBlog.id} className="group hover:shadow-lg transition-all duration-300">
                        <CardContent className="p-6">
                          <h4 className="font-serif text-lg font-bold text-gray-900 mb-2 leading-tight group-hover:text-blue-700 transition-colors">
                            {relatedBlog.title}
                          </h4>
                          {relatedBlog.excerpt && (
                            <p className="text-gray-600 mb-4 text-sm leading-relaxed">{relatedBlog.excerpt}</p>
                          )}
                          <Button asChild variant="outline" size="sm" className="w-full justify-center group-hover:bg-blue-50 transition-all">
                            <Link href={`/blog/${relatedBlog.id}`} className="flex items-center gap-2">
                              Read Article
                              <ChevronRight className="h-4 w-4 group-hover:translate-x-1 transition-transform" />
                            </Link>
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </section>
              </>
            )}
          </div>
        </article>
      </div>

    </div>
  )
}