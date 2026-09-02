export interface BlogDraft {
  id: string // Unique draft ID (e.g. "draft_1741234567890_abc12") or blog ID for existing posts
  blogId?: string | null // Set if drafting changes for an existing published blog
  title: string
  excerpt: string
  content: string
  author: string
  category: string
  tags: string
  image: string
  featured: boolean
  savedAt: string // ISO date string
  updatedAt: number // Timestamp
}

const DRAFTS_INDEX_KEY = "bcl_all_blog_drafts"

/**
 * Generate a unique ID for a blog draft.
 */
export function generateDraftId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return `draft_${Date.now()}_${crypto.randomUUID().slice(0, 8)}`
  }
  return `draft_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
}

/**
 * Checks if a draft has meaningful user content.
 */
export function hasDraftContent(draft?: Partial<BlogDraft> | null): boolean {
  if (!draft) return false
  const cleanContent = draft.content ? draft.content.replace(/<[^>]*>/g, "").trim() : ""
  return Boolean(
    draft.title?.trim() ||
    cleanContent ||
    draft.excerpt?.trim() ||
    draft.author?.trim() ||
    draft.category?.trim() ||
    draft.tags?.trim() ||
    draft.image?.trim()
  )
}

/**
 * Get draft key for a specific draft ID.
 */
function getStorageKey(draftId: string): string {
  return `bcl_blog_draft_${draftId}`
}

/**
 * Save a blog draft to localStorage and update the drafts index.
 */
export function saveBlogDraft(draftData: {
  id?: string | null
  blogId?: string | null
  title: string
  excerpt: string
  content: string
  author: string
  category: string
  tags: string
  image: string
  featured: boolean
}): BlogDraft | null {
  if (typeof window === "undefined") return null

  // Ensure every draft has a unique non-"new" ID
  let id = draftData.id
  if (!id || id === "new") {
    if (draftData.blogId) {
      id = draftData.blogId
    } else {
      id = generateDraftId()
    }
  }

  const now = new Date()
  
  const draft: BlogDraft = {
    id,
    blogId: draftData.blogId || null,
    title: draftData.title || "",
    excerpt: draftData.excerpt || "",
    content: draftData.content || "",
    author: draftData.author || "",
    category: draftData.category || "",
    tags: draftData.tags || "",
    image: draftData.image || "",
    featured: Boolean(draftData.featured),
    savedAt: now.toISOString(),
    updatedAt: now.getTime(),
  }

  // Only persist if there's actual content
  if (!hasDraftContent(draft)) {
    return null
  }

  try {
    // 1. Save specific draft to localStorage
    const storageKey = getStorageKey(id)
    localStorage.setItem(storageKey, JSON.stringify(draft))

    // 2. Also update in the global drafts index
    const allDrafts = getAllBlogDrafts()
    const existingIndex = allDrafts.findIndex((d) => 
      d.id === id || (Boolean(draft.blogId) && Boolean(d.blogId) && d.blogId === draft.blogId)
    )
    if (existingIndex >= 0) {
      allDrafts[existingIndex] = draft
    } else {
      allDrafts.unshift(draft)
    }

    // Filter out any legacy "new" keys from the index and ensure unique by ID
    const seen = new Set<string>()
    const sanitizedIndex: BlogDraft[] = []
    for (const d of allDrafts) {
      if (d && d.id && d.id !== "new" && !seen.has(d.id)) {
        seen.add(d.id)
        sanitizedIndex.push(d)
      }
    }
    localStorage.setItem(DRAFTS_INDEX_KEY, JSON.stringify(sanitizedIndex))

    return draft
  } catch (err) {
    console.error("Failed to save blog draft to localStorage:", err)
    return null
  }
}

/**
 * Retrieve a blog draft by ID.
 */
export function getBlogDraft(draftId?: string | null): BlogDraft | null {
  if (typeof window === "undefined" || !draftId) return null

  try {
    // 1. Try direct key
    const key = getStorageKey(draftId)
    const raw = localStorage.getItem(key)
    if (raw) {
      const parsed = JSON.parse(raw)
      if (hasDraftContent(parsed)) {
        return parsed as BlogDraft
      }
    }

    // 2. Fallback: Check in allDrafts index
    const allDrafts = getAllBlogDrafts()
    const found = allDrafts.find(d => d.id === draftId || (d.blogId && d.blogId === draftId))
    if (found && hasDraftContent(found)) {
      return found
    }
  } catch (err) {
    console.error("Failed to read blog draft:", err)
  }

  return null
}

/**
 * Get all saved drafts from localStorage.
 */
export function getAllBlogDrafts(): BlogDraft[] {
  if (typeof window === "undefined") return []

  try {
    // 1. Try reading from the drafts index
    const rawIndex = localStorage.getItem(DRAFTS_INDEX_KEY)
    let drafts: BlogDraft[] = []
    if (rawIndex) {
      try {
        const parsed = JSON.parse(rawIndex)
        if (Array.isArray(parsed)) {
          drafts = parsed
        }
      } catch (e) {
        drafts = []
      }
    }

    // 2. Also scan localStorage for any individual drafts `bcl_blog_draft_*` that might not be in index
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith("bcl_blog_draft_") && key !== "bcl_blog_draft_new") {
        const draftIdFromKey = key.replace("bcl_blog_draft_", "")
        if (!drafts.some((d) => d.id === draftIdFromKey)) {
          try {
            const rawDraft = localStorage.getItem(key)
            if (rawDraft) {
              const parsed = JSON.parse(rawDraft) as BlogDraft
              if (parsed && hasDraftContent(parsed)) {
                if (!parsed.id) parsed.id = draftIdFromKey
                drafts.push(parsed)
              }
            }
          } catch (e) {}
        }
      }
    }

    // 3. Migration: check if legacy "bcl_blog_draft_new" exists and migrate it
    const legacyNewRaw = localStorage.getItem("bcl_blog_draft_new")
    if (legacyNewRaw) {
      try {
        const legacyDraft = JSON.parse(legacyNewRaw) as BlogDraft
        if (hasDraftContent(legacyDraft)) {
          const migratedId = generateDraftId()
          legacyDraft.id = migratedId
          localStorage.setItem(getStorageKey(migratedId), JSON.stringify(legacyDraft))
          drafts.unshift(legacyDraft)
        }
        localStorage.removeItem("bcl_blog_draft_new")
      } catch (e) {}
    }

    // Deduplicate and filter out empty / invalid drafts
    const seenIds = new Set<string>()
    const sanitizedDrafts: BlogDraft[] = []

    for (const d of drafts) {
      if (d && d.id && d.id !== "new" && hasDraftContent(d) && !seenIds.has(d.id)) {
        seenIds.add(d.id)
        sanitizedDrafts.push(d)
      }
    }

    // Keep storage index cleaned up
    localStorage.setItem(DRAFTS_INDEX_KEY, JSON.stringify(sanitizedDrafts))

    // Filter out invalid/empty drafts and sort by newest
    return sanitizedDrafts.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  } catch (err) {
    console.error("Failed to retrieve blog drafts list:", err)
    return []
  }
}

/**
 * Delete a draft by ID.
 */
export function deleteBlogDraft(draftId: string): void {
  if (typeof window === "undefined" || !draftId) return

  try {
    const key = getStorageKey(draftId)
    localStorage.removeItem(key)
    localStorage.removeItem(`bcl_blog_draft_${draftId}`)
    if (draftId === "new") {
      localStorage.removeItem("bcl_blog_draft_new")
    }

    // Remove from index
    const rawIndex = localStorage.getItem(DRAFTS_INDEX_KEY)
    if (rawIndex) {
      try {
        const parsed = JSON.parse(rawIndex)
        if (Array.isArray(parsed)) {
          const filtered = parsed.filter((d: BlogDraft) => d.id !== draftId && d.blogId !== draftId)
          localStorage.setItem(DRAFTS_INDEX_KEY, JSON.stringify(filtered))
        }
      } catch (e) {}
    }
  } catch (err) {
    console.error("Failed to delete draft:", err)
  }
}

/**
 * Format a saved timestamp into a friendly human-readable string.
 */
export function formatDraftTime(isoOrTimestamp?: string | number): string {
  if (!isoOrTimestamp) return ""
  try {
    const date = new Date(isoOrTimestamp)
    const now = new Date()
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear()

    const timeStr = date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    if (isToday) {
      return `Today at ${timeStr}`
    }
    return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${timeStr}`
  } catch (e) {
    return ""
  }
}

