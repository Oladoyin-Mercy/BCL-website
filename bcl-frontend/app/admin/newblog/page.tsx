"use client"

import { useState, useEffect, useRef, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  ArrowLeft, Bold, Italic, Underline, Strikethrough, RotateCcw,
  List, ListOrdered, AlignLeft, AlignCenter, AlignRight,
  Link as LinkIcon, Image as ImageIcon,
  Upload, Trash2, Calendar, Clock, Eye, Edit, Loader2,
  Save, Check, FileText
} from "lucide-react"
import { adminApi, blogApi, Blog, formatDate, getImageUrl } from "@/lib/api"
import {
  saveBlogDraft,
  getBlogDraft,
  deleteBlogDraft,
  getAllBlogDrafts,
  formatDraftTime,
  hasDraftContent,
  generateDraftId,
  BlogDraft
} from "@/lib/drafts"

export default function AddBlogPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-500 font-medium">Loading form...</p>
        </div>
      </div>
    }>
      <BlogBuilderFormWrapper />
    </Suspense>
  )
}

function BlogBuilderFormWrapper() {
  const searchParams = useSearchParams()
  const blogId = searchParams.get("id")
  const draftIdParam = searchParams.get("draftId")
  // Using a stable key ensures switching between drafts or starting a new blog completely re-initializes form state
  const formKey = blogId ? `blog_${blogId}` : draftIdParam ? `draft_${draftIdParam}` : "new_blog_draft"
  return <BlogBuilderForm key={formKey} />
}

function BlogBuilderForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const blogId = searchParams.get("id")
  const draftIdParam = searchParams.get("draftId")
  const isResumeDraftParam = searchParams.get("resumeDraft") === "true"

  // Active unique draft ID
  const [currentDraftId, setCurrentDraftId] = useState<string>(() => {
    return blogId || draftIdParam || generateDraftId()
  })

  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [authChecking, setAuthChecking] = useState(true)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [activeTab, setActiveTab] = useState("write")

  const [draftSavedAt, setDraftSavedAt] = useState<string | null>(null)
  const [saveDraftSuccess, setSaveDraftSuccess] = useState(false)
  const [isDraftRestored, setIsDraftRestored] = useState(false)
  const [availableDraftToRestore, setAvailableDraftToRestore] = useState<BlogDraft | null>(null)
  const [allDraftsList, setAllDraftsList] = useState<BlogDraft[]>([])
  const [isDraftsModalOpen, setIsDraftsModalOpen] = useState(false)

  const refreshDraftsList = useCallback(() => {
    const list = getAllBlogDrafts()
    setAllDraftsList(list)
  }, [])

  useEffect(() => {
    refreshDraftsList()
  }, [refreshDraftsList])

  // Inline Image Dialog state
  const [isInlineImageDialogOpen, setIsInlineImageDialogOpen] = useState(false)
  const [inlineImageUrl, setInlineImageUrl] = useState("")
  const [inlineImageCaption, setInlineImageCaption] = useState("")
  const [uploadingInlineImage, setUploadingInlineImage] = useState(false)
  const inlineFileInputRef = useRef<HTMLInputElement>(null)

  // Current block format in editor
  const [currentBlockFormat, setCurrentBlockFormat] = useState("p")

  const [formData, setFormData] = useState({
    title: "",
    excerpt: "",
    content: "",
    author: "",
    category: "",
    tags: "",
    image: "",
    featured: false
  })

  const editorRef = useRef<HTMLDivElement>(null)
  const [menuPosition, setMenuPosition] = useState<{ x: number; y: number } | null>(null)
  const autoSaveTimerRef = useRef<NodeJS.Timeout | null>(null)
  const initialDraftLoadedRef = useRef(false)
  const savedSelectionRef = useRef<Range | null>(null)

  // Auth Check
  useEffect(() => {
    const token = localStorage.getItem("admin_token")
    if (token) {
      setIsAuthenticated(true)
    } else {
      setIsAuthenticated(false)
    }
    setAuthChecking(false)
  }, [])

  // Draft loading and check for new blogs vs resumes
  useEffect(() => {
    if (authChecking || initialDraftLoadedRef.current) return
    if (!blogId) {
      try {
        if (draftIdParam) {
          const existingDraft = getBlogDraft(draftIdParam)
          if (existingDraft && hasDraftContent(existingDraft)) {
            setFormData({
              title: existingDraft.title || "",
              excerpt: existingDraft.excerpt || "",
              content: existingDraft.content || "",
              author: existingDraft.author || "",
              category: existingDraft.category || "",
              tags: existingDraft.tags || "",
              image: existingDraft.image || "",
              featured: Boolean(existingDraft.featured)
            })
            if (existingDraft.savedAt) {
              setDraftSavedAt(formatDraftTime(existingDraft.savedAt))
            }
            setIsDraftRestored(true)
            initialDraftLoadedRef.current = true

            setTimeout(() => {
              if (editorRef.current && existingDraft.content) {
                editorRef.current.innerHTML = existingDraft.content
              }
            }, 50)
          } else {
            initialDraftLoadedRef.current = true
          }
        } else {
          // Starting a brand new draft without draftIdParam
          if (typeof window !== "undefined" && currentDraftId) {
            window.history.replaceState(null, "", `/admin/newblog?draftId=${currentDraftId}`)
          }
          initialDraftLoadedRef.current = true
        }
      } catch (e) {
        console.error("Error checking draft:", e)
      }
    }
  }, [blogId, draftIdParam, isResumeDraftParam, authChecking, currentDraftId])

  // Fetch Blog if Editing an existing post
  useEffect(() => {
    if (blogId && isAuthenticated) {
      setIsEditing(true)
      const fetchBlog = async () => {
        try {
          setLoading(true)
          const data = await blogApi.getBlog(blogId)
          let blogState = {
            title: data.title || "",
            excerpt: data.excerpt || "",
            content: data.content || "",
            author: data.author || "",
            category: data.category || "",
            tags: (data.tags || []).join(", "),
            image: data.image || "",
            featured: Boolean(data.featured)
          }

          // Check if there is an unsaved local draft for this specific blog
          const savedDraft = getBlogDraft(blogId)
          if (savedDraft && hasDraftContent(savedDraft)) {
            try {
              if (savedDraft.savedAt && (!data.updated_at || new Date(savedDraft.savedAt) > new Date(data.updated_at))) {
                if (isResumeDraftParam) {
                  blogState = {
                    title: savedDraft.title || blogState.title,
                    excerpt: savedDraft.excerpt || blogState.excerpt,
                    content: savedDraft.content || blogState.content,
                    author: savedDraft.author || blogState.author,
                    category: savedDraft.category || blogState.category,
                    tags: savedDraft.tags || blogState.tags,
                    image: savedDraft.image !== undefined ? savedDraft.image : blogState.image,
                    featured: savedDraft.featured !== undefined ? savedDraft.featured : blogState.featured
                  }
                  setDraftSavedAt(formatDraftTime(savedDraft.savedAt))
                  setIsDraftRestored(true)
                } else {
                  setAvailableDraftToRestore(savedDraft)
                }
              }
            } catch (err) {
              console.error("Error reading draft for blog:", err)
            }
          }

          setFormData(blogState)
          initialDraftLoadedRef.current = true

          setTimeout(() => {
            if (editorRef.current && blogState.content) {
              editorRef.current.innerHTML = blogState.content
            }
          }, 50)
        } catch (err) {
          alert("Failed to load blog post: " + (err instanceof Error ? err.message : err))
          router.push("/admin")
        } finally {
          setLoading(false)
        }
      }
      fetchBlog()
    }
  }, [blogId, isAuthenticated, isResumeDraftParam, router])

  // Sync editor content on load or reset
  useEffect(() => {
    if (!loading && editorRef.current && activeTab === "write") {
      if (formData.content && (!editorRef.current.innerHTML || editorRef.current.innerHTML === "<p><br></p>" || editorRef.current.innerHTML === "")) {
        editorRef.current.innerHTML = formData.content
      }
    }
  }, [loading, activeTab, formData.content])

  // Selection change handler for floating toolbar and saved selection
  useEffect(() => {
    const handleSelectionChange = () => {
      const selection = window.getSelection()
      if (!selection || selection.rangeCount === 0) {
        setMenuPosition(null)
        return
      }

      const range = selection.getRangeAt(0)
      const editorEl = editorRef.current
      if (editorEl && editorEl.contains(range.commonAncestorContainer)) {
        savedSelectionRef.current = range.cloneRange()
      }

      if (selection.isCollapsed) {
        setMenuPosition(null)
        return
      }

      const text = selection.toString().trim()
      if (text.length === 0) {
        setMenuPosition(null)
        return
      }

      try {
        if (editorEl && editorEl.contains(range.commonAncestorContainer)) {
          const rect = range.getBoundingClientRect()
          setMenuPosition({
            x: rect.left + rect.width / 2,
            y: rect.top - 8,
          })
        } else {
          setMenuPosition(null)
        }
      } catch (e) {
        setMenuPosition(null)
      }
    }

    document.addEventListener("selectionchange", handleSelectionChange)
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange)
    }
  }, [])

  // Restore selection helper
  const restoreSelection = () => {
    const sel = window.getSelection()
    if (sel && savedSelectionRef.current) {
      sel.removeAllRanges()
      sel.addRange(savedSelectionRef.current)
    }
  }

  // Direct synchronous save draft
  const saveDraftDirectly = useCallback((overrideContent?: string) => {
    const content = overrideContent !== undefined ? overrideContent : (editorRef.current ? editorRef.current.innerHTML : formData.content)
    const activeDraftId = blogId || currentDraftId
    const dataToSave = {
      ...formData,
      content,
      blogId: blogId || null,
      id: activeDraftId
    }

    if (!hasDraftContent(dataToSave)) return false

    const saved = saveBlogDraft(dataToSave)
    if (saved) {
      setDraftSavedAt(formatDraftTime(saved.savedAt))
      refreshDraftsList()
      return true
    }
    return false
  }, [formData, blogId, currentDraftId, refreshDraftsList])

  // Debounced auto-save on form data or editor change
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current)
    }
    autoSaveTimerRef.current = setTimeout(() => {
      saveDraftDirectly()
    }, 1200)
  }, [saveDraftDirectly])

  const handleEditorInput = () => {
    if (editorRef.current) {
      const currentContent = editorRef.current.innerHTML
      setFormData(prev => ({ ...prev, content: currentContent }))
      triggerAutoSave()
    }
  }

  const executeCommand = (command: string, arg: string = "") => {
    if (editorRef.current) {
      editorRef.current.focus()
    }
    document.execCommand(command, false, arg)
    handleEditorInput()
  }

  const handleFormatChange = (val: string) => {
    setCurrentBlockFormat(val)
    if (editorRef.current) {
      editorRef.current.focus()
    }
    if (val === "14px" || val === "16px" || val === "20px" || val === "24px" || val === "32px") {
      restoreSelection()
      if (editorRef.current) {
        editorRef.current.focus()
      }
      const selection = window.getSelection()
      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0)
        if (!selection.isCollapsed) {
          const span = document.createElement("span")
          span.style.fontSize = val
          span.appendChild(range.extractContents())
          range.insertNode(span)
          range.selectNodeContents(span)
          selection.removeAllRanges()
          selection.addRange(range)
        } else {
          const span = document.createElement("span")
          span.style.fontSize = val
          span.innerHTML = "&#8203;"
          range.insertNode(span)
          range.setStart(span, 1)
          range.setEnd(span, 1)
          selection.removeAllRanges()
          selection.addRange(range)
        }
        handleEditorInput()
      }
    } else if (val === "p" || val === "h1" || val === "h2" || val === "h3" || val === "h4" || val === "blockquote") {
      restoreSelection()
      if (editorRef.current) {
        editorRef.current.focus()
      }
      document.execCommand("formatBlock", false, `<${val}>`)
      handleEditorInput()
    }
  }

  const handleAddLink = () => {
    restoreSelection()
    const url = window.prompt("Enter link URL (e.g. https://example.com):", "https://")
    if (url && url.trim() && url !== "https://") {
      if (editorRef.current) {
        editorRef.current.focus()
      }
      document.execCommand("createLink", false, url.trim())
      handleEditorInput()
    }
  }

  // Cover image upload
  const handleCoverImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingImage(true)
    try {
      const res = await adminApi.uploadFile(file, "blogs")
      setFormData(prev => ({ ...prev, image: res.url }))
      triggerAutoSave()
    } catch (err) {
      alert("Image upload failed: " + (err instanceof Error ? err.message : err))
    } finally {
      setUploadingImage(false)
    }
  }

  // Insert Inline Image HTML with optional editable caption
  const insertInlineImageHtml = (url: string, captionText: string) => {
    restoreSelection()
    if (editorRef.current) {
      editorRef.current.focus()
    }
    const resolved = getImageUrl(url)
    const captionHtml = captionText?.trim()
      ? `<figcaption class="image-caption" style="text-align: center; font-size: 0.875rem; color: #6b7280; font-style: italic; margin-top: 0.5rem;" contenteditable="true">${captionText.trim()}</figcaption>`
      : ""

    const figureHtml = `<figure style="margin: 1.5rem 0; text-align: center;" class="inline-image-figure"><img src="${resolved}" alt="${captionText?.trim() || 'Blog image'}" style="max-width: 100%; height: auto; border-radius: 0.5rem; display: block; margin: 0 auto; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);" />${captionHtml}</figure><p><br></p>`

    document.execCommand("insertHTML", false, figureHtml)
    handleEditorInput()
    setIsInlineImageDialogOpen(false)
    setInlineImageUrl("")
    setInlineImageCaption("")
  }

  // Inline Image: file upload handler
  const handleInlineImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingInlineImage(true)
    try {
      const res = await adminApi.uploadFile(file, "blogs")
      insertInlineImageHtml(res.url, inlineImageCaption)
    } catch (err) {
      alert("Failed to upload inline image: " + (err instanceof Error ? err.message : err))
    } finally {
      setUploadingInlineImage(false)
      if (inlineFileInputRef.current) inlineFileInputRef.current.value = ""
    }
  }

  // Inline Image: URL submit handler
  const handleInsertInlineImageUrl = () => {
    if (!inlineImageUrl.trim()) return
    insertInlineImageHtml(inlineImageUrl.trim(), inlineImageCaption)
  }

  // Explicit Save Draft trigger with UI feedback
  const saveDraft = (showFeedback = true) => {
    try {
      const content = editorRef.current ? editorRef.current.innerHTML : formData.content
      const activeDraftId = blogId || currentDraftId
      const saved = saveBlogDraft({
        ...formData,
        content,
        blogId: blogId || null,
        id: activeDraftId
      })

      if (saved) {
        setDraftSavedAt(formatDraftTime(saved.savedAt))
        refreshDraftsList()
        if (showFeedback) {
          setSaveDraftSuccess(true)
          setTimeout(() => setSaveDraftSuccess(false), 2500)
        }
      } else {
        if (showFeedback) {
          alert("Please type something in the title or content to save as a draft.")
        }
      }
    } catch (err) {
      alert("Failed to save draft: " + (err instanceof Error ? err.message : err))
    }
  }

  // Restore available draft action
  const handleRestoreAvailableDraft = () => {
    if (!availableDraftToRestore) return
    setFormData({
      title: availableDraftToRestore.title || "",
      excerpt: availableDraftToRestore.excerpt || "",
      content: availableDraftToRestore.content || "",
      author: availableDraftToRestore.author || "",
      category: availableDraftToRestore.category || "",
      tags: availableDraftToRestore.tags || "",
      image: availableDraftToRestore.image || "",
      featured: Boolean(availableDraftToRestore.featured)
    })
    if (availableDraftToRestore.savedAt) {
      setDraftSavedAt(formatDraftTime(availableDraftToRestore.savedAt))
    }
    if (editorRef.current && availableDraftToRestore.content) {
      editorRef.current.innerHTML = availableDraftToRestore.content
    }
    setIsDraftRestored(true)
    setAvailableDraftToRestore(null)
  }

  // Clear / Discard Draft
  const handleDiscardDraft = () => {
    if (confirm("Are you sure you want to discard this saved draft? This will clear unsaved content.")) {
      const targetDraftId = blogId || currentDraftId
      deleteBlogDraft(targetDraftId)
      refreshDraftsList()
      setIsDraftRestored(false)
      setAvailableDraftToRestore(null)
      setDraftSavedAt(null)
      if (isEditing && blogId) {
        window.location.reload()
      } else {
        const newDraftId = generateDraftId()
        setCurrentDraftId(newDraftId)
        if (typeof window !== "undefined") {
          window.history.replaceState(null, "", `/admin/newblog?draftId=${newDraftId}`)
        }
        setFormData({
          title: "",
          excerpt: "",
          content: "",
          author: "",
          category: "",
          tags: "",
          image: "",
          featured: false
        })
        if (editorRef.current) {
          editorRef.current.innerHTML = ""
        }
      }
    }
  }

  // Periodic auto-save every 20 seconds if content exists
  useEffect(() => {
    const interval = setInterval(() => {
      if (hasDraftContent(formData)) {
        saveDraftDirectly()
      }
    }, 20000)
    return () => clearInterval(interval)
  }, [saveDraftDirectly, formData])

  // Seamless tab switching
  const handleTabChange = (newTab: string) => {
    if (activeTab === "write" && editorRef.current) {
      const currentContent = editorRef.current.innerHTML
      setFormData(prev => ({ ...prev, content: currentContent }))
      if (hasDraftContent(formData) || currentContent.trim()) {
        saveDraftDirectly(currentContent)
      }
    }

    setActiveTab(newTab)

    if (newTab === "write") {
      setTimeout(() => {
        if (editorRef.current && formData.content) {
          if (editorRef.current.innerHTML !== formData.content) {
            editorRef.current.innerHTML = formData.content
          }
        }
      }, 0)
    }
  }

  // Navigate back safely
  const handleNavigateBack = () => {
    if (hasDraftContent(formData)) {
      saveDraftDirectly()
    }
    router.push("/admin")
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const rawContent = editorRef.current ? editorRef.current.innerHTML : formData.content
    const content = rawContent
      ? rawContent
          .replace(/<figcaption[^>]*>\s*Click here to add image caption\.{0,3}\s*<\/figcaption>/gi, '')
          .replace(/<figcaption[^>]*>\s*Click here to add caption\.{0,3}\s*<\/figcaption>/gi, '')
          .replace(/<figcaption[^>]*>\s*<\/figcaption>/gi, '')
      : ""
    if (!formData.title?.trim()) return alert("Title is required")
    if (!content?.trim() || content === "<p><br></p>" || content === "<p></p>") return alert("Content is required")
    if (!formData.author?.trim()) return alert("Author name is required")
    if (!formData.category?.trim()) return alert("Category is required")

    setSaving(true)
    try {
      const blogData = {
        title: formData.title,
        excerpt: formData.excerpt,
        content: content,
        author: formData.author,
        author_bio: "",
        category: formData.category,
        tags: formData.tags.split(",").map(t => t.trim()).filter(Boolean),
        image: formData.image,
        featured: formData.featured
      }

      const activeDraftKey = blogId || currentDraftId

      if (isEditing && blogId) {
        await adminApi.updateBlog(blogId, blogData)
        deleteBlogDraft(activeDraftKey)
        alert("Blog updated successfully!")
      } else {
        await adminApi.createBlog(blogData as any)
        deleteBlogDraft(activeDraftKey)
        alert("Blog created successfully!")
      }
      router.push("/admin")
    } catch (err) {
      alert("Failed to save blog: " + (err instanceof Error ? err.message : err))
    } finally {
      setSaving(false)
    }
  }

  if (authChecking || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-gray-500 font-medium">Please wait...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-2xl font-bold text-red-600">Access Denied</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-gray-600">You must be logged in as an administrator to access this page.</p>
            <Button className="w-full" onClick={() => router.push("/admin")}>
              Go to Admin Login
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50 pb-16">
      {/* Header Panel - Sticky below site header */}
      <section className="bg-white/95 backdrop-blur-sm border-b sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleNavigateBack}
                className="hover:bg-gray-100"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="font-serif text-xl sm:text-2xl font-bold text-gray-900">
                  {isEditing ? "Edit Blog Post" : "Create New Blog Post"}
                </h1>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full sm:w-auto">
              <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full sm:w-auto">
                <TabsList className="bg-gray-100 p-1 w-full sm:w-auto grid grid-cols-2 sm:flex">
                  <TabsTrigger value="write" className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm">
                    <Edit className="h-4 w-4" /> Write
                  </TabsTrigger>
                  <TabsTrigger value="preview" className="flex items-center justify-center gap-1.5 px-3 py-1.5 text-sm">
                    <Eye className="h-4 w-4" /> Preview
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              <Separator orientation="vertical" className="h-8 hidden sm:block" />

              <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                {allDraftsList.length > 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setIsDraftsModalOpen(true)}
                    className="h-9 text-xs font-medium text-blue-700 border-blue-200 bg-blue-50/60 hover:bg-blue-100 hover:text-blue-800 flex items-center gap-1.5"
                    title="View and switch between all saved drafts"
                  >
                    <FileText className="h-3.5 w-3.5 text-blue-600" />
                    <span>Drafts ({allDraftsList.length})</span>
                  </Button>
                )}

                {draftSavedAt && (
                  <div className="hidden lg:flex items-center gap-1.5 text-xs text-gray-500 bg-gray-50 px-2.5 py-1.5 rounded-md border border-gray-200">
                    <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                    <span>Saved {draftSavedAt}</span>
                  </div>
                )}

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => saveDraft(true)}
                  disabled={saving}
                  className="border-gray-300 hover:bg-gray-100 text-gray-700 font-medium flex items-center gap-1.5 flex-1 sm:flex-none"
                  title="Save draft locally"
                >
                  {saveDraftSuccess ? (
                    <>
                      <Check className="h-4 w-4 text-emerald-600" />
                      <span className="text-emerald-700">Saved</span>
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 text-gray-600" />
                      <span>Save Draft</span>
                    </>
                  )}
                </Button>

                <Button variant="outline" onClick={handleNavigateBack} disabled={saving} className="flex-1 sm:flex-none">
                  Cancel
                </Button>
                <Button onClick={handleSubmit} disabled={saving} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold flex-1 sm:flex-none">
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...
                    </>
                  ) : (
                    isEditing ? "Save Changes" : "Publish Blog"
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Saved Drafts Switcher Dialog */}
      <Dialog open={isDraftsModalOpen} onOpenChange={setIsDraftsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <FileText className="h-5 w-5 text-blue-600" />
              Saved Drafts ({allDraftsList.length})
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <p className="text-xs text-gray-500">
                Click &quot;Resume&quot; to switch to a draft, or click &quot;New Blog&quot; to write a fresh post.
              </p>
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  setIsDraftsModalOpen(false)
                  router.push("/admin/newblog")
                }}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-7 px-2.5 font-medium"
              >
                + New Post
              </Button>
            </div>
            {allDraftsList.length === 0 ? (
              <p className="text-center py-6 text-sm text-gray-500">No saved drafts found.</p>
            ) : (
              <div className="space-y-2.5">
                {allDraftsList.map((d) => {
                  const isCurrent = (blogId && d.blogId === blogId) || (!blogId && d.id === currentDraftId)
                  const plainContent = d.content ? d.content.replace(/<[^>]*>/g, " ").trim() : ""
                  const displayExcerpt = d.excerpt || plainContent || "No preview available"
                  return (
                    <div
                      key={d.id}
                      className={`p-3.5 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                        isCurrent ? "bg-blue-50/70 border-blue-300 ring-1 ring-blue-300" : "bg-white border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="space-y-1 min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-900 truncate">
                            {d.title || "Untitled Draft"}
                          </span>
                          {isCurrent && (
                            <Badge className="bg-blue-600 text-white text-[10px] px-1.5 py-0 h-4 font-normal">
                              Currently Editing
                            </Badge>
                          )}
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-normal">
                            {d.category || "General"}
                          </Badge>
                        </div>
                        <p className="text-xs text-gray-500 line-clamp-1">{displayExcerpt}</p>
                        <p className="text-[11px] text-gray-400">
                          Saved {formatDraftTime(d.savedAt)} • Author: {d.author || "Admin"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0 justify-end">
                        {!isCurrent && (
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setIsDraftsModalOpen(false)
                              router.push(d.blogId ? `/admin/newblog?id=${d.blogId}&resumeDraft=true` : `/admin/newblog?draftId=${d.id}&resumeDraft=true`)
                            }}
                            className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3 font-medium"
                          >
                            <Edit className="h-3 w-3 mr-1" /> Resume
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            if (confirm(`Discard draft "${d.title || 'Untitled'}"?`)) {
                              deleteBlogDraft(d.id)
                              refreshDraftsList()
                              if (isCurrent) {
                                router.push("/admin/newblog")
                              }
                            }
                          }}
                          className="text-gray-400 hover:text-red-600 hover:bg-red-50 h-8 w-8 p-0"
                          title="Delete draft"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content Area */}
      <section className="py-4 sm:py-8 max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        {/* Available Draft prompt banner when starting fresh and a draft exists */}
        {availableDraftToRestore && !isDraftRestored && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50/80 border border-blue-200 text-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-blue-950">
                  Unsaved Draft Available
                </p>
                <p className="text-xs text-blue-700">
                  You have an earlier unsaved draft{availableDraftToRestore.title ? ` ("${availableDraftToRestore.title}")` : ""}{availableDraftToRestore.savedAt ? ` from ${formatDraftTime(availableDraftToRestore.savedAt)}` : ""}. Would you like to restore it or start clean?
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                size="sm"
                onClick={handleRestoreAvailableDraft}
                className="bg-blue-600 hover:bg-blue-700 text-white text-xs h-8 px-3 font-medium"
              >
                Restore Draft
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setAvailableDraftToRestore(null)}
                className="text-xs text-blue-700 hover:bg-blue-100 h-8 px-2.5"
              >
                Dismiss (Start Clean)
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  deleteBlogDraft(availableDraftToRestore.id)
                  refreshDraftsList()
                  setAvailableDraftToRestore(null)
                }}
                className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-8 px-2.5"
                title="Permanently remove this draft"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}

        {/* Restored Draft Confirmation Banner */}
        {isDraftRestored && (
          <div className="mb-6 p-4 rounded-xl bg-blue-50 border border-blue-200 text-blue-900 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <FileText className="h-5 w-5 text-blue-600 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-950">
                  Draft Restored
                </p>
                <p className="text-xs text-blue-700">
                  We loaded your saved draft {draftSavedAt ? `(saved at ${draftSavedAt})` : ""}.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setIsDraftRestored(false)}
                className="text-xs text-blue-700 hover:bg-blue-100 h-8 px-3"
              >
                Dismiss
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleDiscardDraft}
                className="text-xs text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700 h-8 px-3"
              >
                <Trash2 className="h-3.5 w-3.5 mr-1" /> Discard Draft
              </Button>
            </div>
          </div>
        )}

        {/* Form / Editor (Kept mounted in DOM to prevent content loss) */}
        <div className={activeTab === "write" ? "block" : "hidden"}>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
            {/* Editor & Core Fields */}
            <div className="lg:col-span-2 space-y-4 sm:space-y-6">
              <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
                <CardContent className="px-3 sm:px-6 py-4 sm:py-6 space-y-4 sm:space-y-6">
                  {/* Title field */}
                  <div className="space-y-2">
                    <Label htmlFor="title" className="text-sm font-semibold text-gray-700">Title *</Label>
                    <Input
                      id="title"
                      placeholder="Enter article title..."
                      value={formData.title}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, title: e.target.value }))
                        triggerAutoSave()
                      }}
                      className="text-lg font-medium"
                      required
                    />
                  </div>

                  {/* Excerpt field */}
                  <div className="space-y-2">
                    <Label htmlFor="excerpt" className="text-sm font-semibold text-gray-700">Excerpt *</Label>
                    <Textarea
                      id="excerpt"
                      placeholder="Short overview or summary of the blog post..."
                      value={formData.excerpt}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, excerpt: e.target.value }))
                        triggerAutoSave()
                      }}
                      rows={2}
                      required
                    />
                  </div>

                  {/* Rich Text Editor field */}
                  <div className="space-y-2 relative">
                    <Label className="text-sm font-semibold text-gray-700">Article Content *</Label>
                    <div className="border border-gray-200 rounded-lg bg-white shadow-xs">
                      {/* Full Editing Toolbar - Sticky on Scroll */}
                      <div className="sticky top-[136px] sm:top-[140px] z-20 flex flex-wrap items-center gap-1 p-2.5 bg-gray-50/95 backdrop-blur-md border-b border-gray-200 rounded-t-lg shadow-xs">
                        {/* Format / Size dropdown without arrow up or down */}
                        <div className="mr-1">
                          <Select value={currentBlockFormat} onValueChange={handleFormatChange}>
                            <SelectTrigger hideArrow className="h-8 w-[115px] sm:w-[130px] text-xs bg-white border-gray-300 font-medium">
                              <SelectValue placeholder="Format / Size" />
                            </SelectTrigger>
                            <SelectContent className="max-h-72" hideScrollArrows>
                              <SelectItem value="p">Paragraph</SelectItem>
                              <SelectItem value="h1">H1</SelectItem>
                              <SelectItem value="h2">H2</SelectItem>
                              <SelectItem value="h3">H3</SelectItem>
                              <SelectItem value="h4">H4</SelectItem>
                              <SelectItem value="blockquote">Quote Block</SelectItem>
                              <SelectItem value="14px">14px</SelectItem>
                              <SelectItem value="16px">16px</SelectItem>
                              <SelectItem value="20px">20px</SelectItem>
                              <SelectItem value="24px">24px</SelectItem>
                              <SelectItem value="32px">32px</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="w-px h-5 bg-gray-300 mx-0.5 hidden sm:block" />

                        {/* Bold */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-700 hover:text-black hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("bold") }}
                          title="Bold (Ctrl+B)"
                        >
                          <Bold className="h-4 w-4" />
                        </Button>

                        {/* Italic */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-700 hover:text-black hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("italic") }}
                          title="Italic (Ctrl+I)"
                        >
                          <Italic className="h-4 w-4" />
                        </Button>

                        {/* Underline */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-700 hover:text-black hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("underline") }}
                          title="Underline (Ctrl+U)"
                        >
                          <Underline className="h-4 w-4" />
                        </Button>

                        {/* Strikethrough */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-700 hover:text-black hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("strikeThrough") }}
                          title="Strikethrough"
                        >
                          <Strikethrough className="h-4 w-4" />
                        </Button>

                        <div className="w-px h-5 bg-gray-300 mx-0.5" />

                        {/* Bullet List */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-700 hover:text-black hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("insertUnorderedList") }}
                          title="Bullet List"
                        >
                          <List className="h-4 w-4" />
                        </Button>

                        {/* Numbered List */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-700 hover:text-black hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("insertOrderedList") }}
                          title="Numbered List"
                        >
                          <ListOrdered className="h-4 w-4" />
                        </Button>

                        <div className="w-px h-5 bg-gray-300 mx-0.5 hidden sm:block" />

                        {/* Align Left */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-700 hover:text-black hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyLeft") }}
                          title="Align Left"
                        >
                          <AlignLeft className="h-4 w-4" />
                        </Button>

                        {/* Align Center */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-700 hover:text-black hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyCenter") }}
                          title="Align Center"
                        >
                          <AlignCenter className="h-4 w-4" />
                        </Button>

                        {/* Align Right */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-gray-700 hover:text-black hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("justifyRight") }}
                          title="Align Right"
                        >
                          <AlignRight className="h-4 w-4" />
                        </Button>

                        <div className="w-px h-5 bg-gray-300 mx-0.5" />

                        {/* Link Tool */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                          onMouseDown={(e) => { e.preventDefault(); handleAddLink() }}
                          title="Insert Link"
                        >
                          <LinkIcon className="h-3.5 w-3.5" />
                          <span>Link</span>
                        </Button>

                        {/* Inline Image Tool */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-xs font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 flex items-center gap-1"
                          onMouseDown={(e) => {
                            e.preventDefault()
                            restoreSelection()
                            setIsInlineImageDialogOpen(true)
                          }}
                          title="Insert Inline Image"
                        >
                          <ImageIcon className="h-3.5 w-3.5" />
                          <span>Inline Image</span>
                        </Button>

                        {/* Clear Formatting / Reset on Far Right */}
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 ml-auto text-gray-500 hover:text-gray-900 hover:bg-gray-200/70"
                          onMouseDown={(e) => { e.preventDefault(); executeCommand("removeFormat") }}
                          title="Clear Formatting"
                        >
                          <RotateCcw className="h-4 w-4" />
                        </Button>
                      </div>

                      {/* Floating Highlight Toolbar on selection */}
                      {menuPosition && (
                        <div
                          className="fixed z-40 flex items-center gap-1 bg-gray-900 text-white rounded-md shadow-lg px-2 py-1.5 border border-gray-800 transition-all pointer-events-auto"
                          style={{
                            top: `${menuPosition.y}px`,
                            left: `${menuPosition.x}px`,
                            transform: "translate(-50%, -100%)",
                          }}
                        >
                          <button
                            type="button"
                            className="p-1 hover:bg-gray-800 rounded transition-colors text-white"
                            onMouseDown={(e) => { e.preventDefault(); executeCommand("bold") }}
                            title="Bold"
                          >
                            <Bold className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:bg-gray-800 rounded transition-colors text-white"
                            onMouseDown={(e) => { e.preventDefault(); executeCommand("italic") }}
                            title="Italic"
                          >
                            <Italic className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:bg-gray-800 rounded transition-colors text-white"
                            onMouseDown={(e) => { e.preventDefault(); executeCommand("underline") }}
                            title="Underline"
                          >
                            <Underline className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:bg-gray-800 rounded transition-colors text-white"
                            onMouseDown={(e) => { e.preventDefault(); executeCommand("strikeThrough") }}
                            title="Strikethrough"
                          >
                            <Strikethrough className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            className="p-1 hover:bg-gray-800 rounded transition-colors text-white"
                            onMouseDown={(e) => { e.preventDefault(); handleAddLink() }}
                            title="Link"
                          >
                            <LinkIcon className="h-4 w-4" />
                          </button>
                        </div>
                      )}

                      {/* Editable Text Area with placeholder */}
                      <div
                        ref={editorRef}
                        contentEditable
                        onInput={handleEditorInput}
                        data-placeholder="Start typing your article here..."
                        className="rich-editor min-h-[360px] p-4 sm:p-6 focus:outline-hidden prose prose-blue max-w-none text-gray-800 overflow-y-auto rounded-b-lg"
                        style={{ outline: "none" }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Sidebar Meta Info */}
            <div className="space-y-4 sm:space-y-6">
              <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
                <CardHeader className="px-3 sm:px-6 py-4 sm:py-4 pb-2 sm:pb-2">
                  <CardTitle className="text-base font-semibold">Publish Settings</CardTitle>
                </CardHeader>
                <CardContent className="px-3 sm:px-6 pb-6 space-y-4 sm:space-y-6">
                  {/* Category Selector */}
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-sm font-medium">Category *</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(val) => {
                        setFormData(prev => ({ ...prev, category: val }))
                        triggerAutoSave()
                      }}
                    >
                      <SelectTrigger id="category">
                        <SelectValue placeholder="Select category" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Education">Education</SelectItem>
                        <SelectItem value="News">News</SelectItem>
                        <SelectItem value="Industry">Industry</SelectItem>
                        <SelectItem value="Workshop">Workshop</SelectItem>
                        <SelectItem value="Security">Security</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Author input */}
                  <div className="space-y-2">
                    <Label htmlFor="author" className="text-sm font-medium">Author Name *</Label>
                    <Input
                      id="author"
                      placeholder="e.g. John Doe"
                      value={formData.author}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, author: e.target.value }))
                        triggerAutoSave()
                      }}
                      required
                    />
                  </div>

                  {/* Tags input */}
                  <div className="space-y-2">
                    <Label htmlFor="tags" className="text-sm font-medium">Tags (comma-separated)</Label>
                    <Input
                      id="tags"
                      placeholder="e.g. Solidity, Ethereum, Security"
                      value={formData.tags}
                      onChange={(e) => {
                        setFormData(prev => ({ ...prev, tags: e.target.value }))
                        triggerAutoSave()
                      }}
                    />
                  </div>

                  {/* Featured Cover Image Upload Option */}
                  <div className="space-y-2">
                    <Label className="text-sm font-medium">Featured Cover Image *</Label>
                    {uploadingImage ? (
                      <div className="border border-gray-200 rounded-lg p-6 flex flex-col items-center justify-center bg-gray-50 h-48">
                        <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                        <span className="text-sm text-gray-500">Uploading image to server...</span>
                      </div>
                    ) : formData.image ? (
                      <div className="relative rounded-lg overflow-hidden border border-gray-200 bg-white">
                        <img src={getImageUrl(formData.image)} alt="Cover Preview" className="w-full h-40 object-cover" />
                        <div className="absolute top-2 right-2 flex gap-1">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            className="h-8 w-8 rounded-full"
                            onClick={() => {
                              setFormData(prev => ({ ...prev, image: "" }))
                              triggerAutoSave()
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:border-primary hover:bg-blue-50/20 transition-all h-40">
                        <Upload className="h-7 w-7 text-gray-400 mb-2" />
                        <span className="text-xs font-semibold text-gray-600 text-center">
                          Upload featured cover image
                        </span>
                        <span className="text-[10px] text-gray-400 mt-1">PNG, JPG, WEBP formats</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handleCoverImageUpload}
                        />
                      </label>
                    )}

                    {/* Secondary URL Paste support */}
                    <div className="pt-2">
                      <p className="text-[11px] text-gray-400 mb-1 text-center">or paste cover image URL</p>
                      <Input
                        placeholder="https://example.com/image.jpg"
                        value={formData.image}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, image: e.target.value }))
                          triggerAutoSave()
                        }}
                        className="text-xs h-8"
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Featured Article checkbox */}
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="featured"
                      checked={formData.featured}
                      onCheckedChange={(val) => {
                        setFormData(prev => ({ ...prev, featured: val as boolean }))
                        triggerAutoSave()
                      }}
                    />
                    <Label htmlFor="featured" className="text-sm font-semibold cursor-pointer">
                      Mark as Featured Article
                    </Label>
                  </div>
                </CardContent>
              </Card>
            </div>
          </form>
        </div>

        {/* Preview Container (Kept mounted in DOM to prevent destruction) */}
        <div className={activeTab === "preview" ? "block" : "hidden"}>
          <div className="max-w-4xl mx-auto px-2 sm:px-0">
            <Card className="bg-white shadow-none sm:shadow-md border-0 sm:border border-gray-100 overflow-hidden">
              <CardContent className="p-4 sm:p-12">
                {/* Back to Editing button in Preview */}
                <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => handleTabChange("write")}
                    className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 font-medium pl-0 flex items-center gap-1.5"
                  >
                    <ArrowLeft className="h-4 w-4" /> Back to Editing
                  </Button>
                  <Badge variant="outline" className="text-xs font-normal text-gray-500 bg-gray-50">
                    Preview Mode
                  </Badge>
                </div>

                {/* Header */}
                <header className="mb-8">
                  <div className="flex gap-2 mb-4">
                    {formData.category && <Badge variant="secondary">{formData.category}</Badge>}
                    {formData.featured && <Badge className="bg-primary text-white">Featured</Badge>}
                  </div>

                  <h1 className="font-serif text-3xl md:text-5xl font-bold text-gray-900 mb-6 leading-tight">
                    {formData.title || "Untitled Blog Post"}
                  </h1>

                  {formData.excerpt && (
                    <p className="text-xl text-gray-600 leading-relaxed mb-6 font-light">
                      {formData.excerpt}
                    </p>
                  )}
                </header>

                {/* Author Info */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 pb-6 border-b gap-4">
                  <div className="flex items-center gap-4">
                    <Avatar className="h-12 w-12">
                      <AvatarFallback className="bg-blue-100 text-blue-800 font-semibold">
                        {(formData.author || "A")
                          .split(" ")
                          .map(n => n[0])
                          .join("")}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <div className="font-medium text-gray-900">{formData.author || "Anonymous"}</div>
                      <div className="flex items-center gap-3 text-sm text-gray-600">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {formatDate(new Date().toISOString())}
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          1 min read
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Cover Image */}
                {formData.image && (
                  <div className="mb-8 rounded-lg overflow-hidden shadow-md">
                    <img
                      src={getImageUrl(formData.image)}
                      alt={formData.title || "Preview"}
                      className="w-full h-64 md:h-96 object-cover"
                    />
                  </div>
                )}

                {/* Article Content */}
                {formData.content ? (
                  <div
                    className="prose prose-lg max-w-none text-gray-700 leading-relaxed space-y-6 blog-content text-justify"
                    dangerouslySetInnerHTML={{
                      __html: formData.content
                        .replace(/<figcaption[^>]*>\s*Click here to add image caption\.{0,3}\s*<\/figcaption>/gi, '')
                        .replace(/<figcaption[^>]*>\s*Click here to add caption\.{0,3}\s*<\/figcaption>/gi, '')
                        .replace(/<figcaption[^>]*>\s*<\/figcaption>/gi, '')
                    }}
                  />
                ) : (
                  <p className="text-gray-400 italic text-center py-12">No content written yet.</p>
                )}

                {/* Tags list */}
                {formData.tags && (
                  <div className="mt-8 pt-6 border-t flex flex-wrap gap-2">
                    {formData.tags.split(",").map(t => t.trim()).filter(Boolean).map(tag => (
                      <Badge key={tag} variant="outline" className="text-gray-600">
                        #{tag}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Inline Image Modal Dialog */}
      <Dialog open={isInlineImageDialogOpen} onOpenChange={setIsInlineImageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Insert Inline Image</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            {/* Image Caption Input */}
            <div className="space-y-1.5">
              <Label htmlFor="inline-caption" className="text-xs font-semibold text-gray-700">Image Caption (optional)</Label>
              <Input
                id="inline-caption"
                placeholder="e.g. BCL Community Workshop & Hackathon"
                value={inlineImageCaption}
                onChange={(e) => setInlineImageCaption(e.target.value)}
                className="text-xs"
              />
            </div>

            <Separator />

            <div>
              <Label className="text-xs font-semibold text-gray-600 mb-2 block">Option 1: Upload from Computer</Label>
              <input
                type="file"
                ref={inlineFileInputRef}
                accept="image/*"
                className="hidden"
                onChange={handleInlineImageUpload}
              />
              <Button
                type="button"
                variant="outline"
                onClick={() => inlineFileInputRef.current?.click()}
                disabled={uploadingInlineImage}
                className="w-full border-dashed border-2 py-6 flex flex-col items-center justify-center gap-1.5 text-gray-600 hover:border-blue-500 hover:text-blue-600"
              >
                {uploadingInlineImage ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                    <span className="text-xs">Uploading image...</span>
                  </>
                ) : (
                  <>
                    <Upload className="h-5 w-5 text-gray-400" />
                    <span className="text-xs font-medium">Select image file</span>
                  </>
                )}
              </Button>
            </div>

            <div className="relative flex items-center justify-center">
              <div className="border-t border-gray-200 w-full" />
              <span className="bg-white px-2 text-xs text-gray-400 uppercase tracking-wider absolute">or</span>
            </div>

            <div className="space-y-2">
              <Label htmlFor="inline-url" className="text-xs font-semibold text-gray-600">Option 2: Image URL</Label>
              <div className="flex gap-2">
                <Input
                  id="inline-url"
                  placeholder="https://example.com/image.png"
                  value={inlineImageUrl}
                  onChange={(e) => setInlineImageUrl(e.target.value)}
                  className="text-xs"
                />
                <Button
                  type="button"
                  onClick={handleInsertInlineImageUrl}
                  disabled={!inlineImageUrl.trim()}
                  className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-3 shrink-0"
                >
                  Insert
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setIsInlineImageDialogOpen(false)
                setInlineImageUrl("")
                setInlineImageCaption("")
              }}
              className="text-xs"
            >
              Cancel
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editor CSS styling */}
      <style jsx global>{`
        .rich-editor:empty:before,
        .rich-editor[data-empty="true"]:before {
          content: attr(data-placeholder);
          color: #9ca3af;
          cursor: text;
          pointer-events: none;
          display: block;
        }
        .rich-editor h1 {
          font-family: inherit;
          font-size: 2rem;
          font-weight: 800;
          color: #111827;
          margin-top: 1.75rem;
          margin-bottom: 0.75rem;
          line-height: 1.2;
        }
        .rich-editor h2 {
          font-family: inherit;
          font-size: 1.5rem;
          font-weight: 700;
          color: #111827;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          line-height: 1.25;
        }
        .rich-editor h3 {
          font-family: inherit;
          font-size: 1.25rem;
          font-weight: 600;
          color: #1f2937;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          line-height: 1.25;
        }
        .rich-editor h4 {
          font-family: inherit;
          font-size: 1.125rem;
          font-weight: 600;
          color: #374151;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
          line-height: 1.3;
        }
        .rich-editor p {
          font-size: 1.125rem;
          line-height: 1.75;
          margin-bottom: 1.25rem;
          color: #374151;
        }
        .rich-editor blockquote {
          border-left: 4px solid #3b82f6;
          background-color: rgba(239, 246, 255, 0.6);
          padding: 1rem 1.25rem;
          margin: 1.5rem 0;
          border-radius: 0 0.5rem 0.5rem 0;
          font-style: italic;
          color: #374151;
          font-size: 1.125rem;
          line-height: 1.75;
        }
        .rich-editor pre {
          background-color: #1f2937;
          color: #f9fafb;
          padding: 1rem;
          border-radius: 0.5rem;
          font-family: monospace;
          font-size: 0.875rem;
          margin: 1.25rem 0;
          overflow-x: auto;
        }
        .rich-editor img {
          border-radius: 0.5rem;
          max-width: 100%;
          height: auto;
          margin: 1.5rem auto 0.5rem auto;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
          display: block;
        }
        .rich-editor figure, .blog-content figure {
          margin: 1.5rem 0;
          text-align: center;
        }
        .rich-editor figcaption, .blog-content figcaption {
          font-size: 0.875rem;
          color: #6b7280;
          font-style: italic;
          margin-top: 0.5rem;
          text-align: center;
        }
        .rich-editor ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .rich-editor ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin-bottom: 1.25rem;
        }
        .rich-editor li {
          font-size: 1.125rem;
          line-height: 1.75;
          margin-bottom: 0.5rem;
          color: #374151;
        }
        .rich-editor a {
          color: #2563eb;
          text-decoration: underline;
          font-weight: 500;
        }
        .rich-editor a:hover {
          color: #1d4ed8;
        }
      `}</style>
    </main>
  )
}
