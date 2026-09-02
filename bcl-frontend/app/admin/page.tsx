"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import {
  Plus, Edit, Trash2, Link as LinkIcon, Eye, Calendar, MapPin,
  Users, BookOpen, Tags, AwardIcon, User, Clock, Lock, LockOpen,
  Loader2, GraduationCap, Download, FileText
} from "lucide-react"
import { adminApi, eventApi, blogApi, memberApi, Event, Blog, Member, formatDate } from "@/lib/api"
import {
  getAllBlogDrafts,
  deleteBlogDraft,
  formatDraftTime,
  BlogDraft
} from "@/lib/drafts"

const API_BASE = "https://bcl-website-95bd.onrender.com"

export default function AdminDashboard() {
  const router = useRouter()
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [loading, setLoading] = useState(true)
  const [events, setEvents] = useState<Event[]>([])
  const [blogs, setBlogs] = useState<Blog[]>([])
  const [members, setMembers] = useState<Member[]>([])
  const [blogDrafts, setBlogDrafts] = useState<BlogDraft[]>([])
  const [loginForm, setLoginForm] = useState({ username: "", password: "" })
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null)
  const [selectedBlog, setBlog] = useState<Blog | null>(null)
  const [selectedMember, setMember] = useState<Member | null>(null)
  const [isEventDialogOpen, setIsEventDialogOpen] = useState(false)
  const [isBlogDialogOpen, setIsBlogDialogOpen] = useState(false)
  const [isBlogUrlDialogOpen, setIsBlogUrlDialogOpen] = useState(false)
  const [isMemberDialogOpen, setIsMemberDialogOpen] = useState(false)

  // Cohort state
  const [applicationsOpen, setApplicationsOpen] = useState<boolean | null>(null)
  const [cohortToggleLoading, setCohortToggleLoading] = useState(false)
  const [cohortStatusUpdatedAt, setCohortStatusUpdatedAt] = useState<string | null>(null)

  const loadDrafts = () => {
    const drafts = getAllBlogDrafts()
    setBlogDrafts(drafts)
  }

  const handleDiscardDraft = (draftId: string) => {
    if (confirm("Are you sure you want to discard this draft?")) {
      deleteBlogDraft(draftId)
      loadDrafts()
    }
  }

  useEffect(() => {
    const token = localStorage.getItem('admin_token')
    if (token) {
      setIsAuthenticated(true)
      fetchData()
    }
    loadDrafts()
    setLoading(false)

    // Automatically update saved drafts whenever the user returns to this tab or saves a draft in another window
    const handleFocus = () => loadDrafts()
    const handleStorage = (e: StorageEvent) => {
      if (e.key?.startsWith("bcl_blog_draft") || e.key === "bcl_all_blog_drafts") {
        loadDrafts()
      }
    }

    window.addEventListener("focus", handleFocus)
    window.addEventListener("storage", handleStorage)

    return () => {
      window.removeEventListener("focus", handleFocus)
      window.removeEventListener("storage", handleStorage)
    }
  }, [])

  const fetchData = async () => {
    try {
      const [eventsData, blogsData, membersData] = await Promise.all([
        eventApi.getEvents(),
        blogApi.getBlogs(),
        adminApi.getMembers()
      ])
      setEvents(eventsData)
      setBlogs(blogsData)
      setMembers(membersData)
    } catch (error) {
      console.error('Failed to fetch data:', error)
    }
  }

  const fetchCohortStatus = async () => {
    try {
      const res = await fetch(`${API_BASE}/cohorts/applications/status`)
      const data = await res.json()
      setApplicationsOpen(data.applications_open)
      setCohortStatusUpdatedAt(data.updated_at)
    } catch (error) {
      console.error('Failed to fetch cohort status:', error)
    }
  }

  const toggleApplications = async (action: "open" | "close") => {
    setCohortToggleLoading(true)
    try {
      const res = await fetch(`${API_BASE}/cohorts/applications/${action}`, {
        method: "PATCH",
      })
      const data = await res.json()
      setApplicationsOpen(data.applications_open)
    } catch (error) {
      alert("Failed to update application status.")
    } finally {
      setCohortToggleLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await adminApi.login(loginForm.username, loginForm.password)
      localStorage.setItem('admin_token', response.access_token)
      setIsAuthenticated(true)
      loadDrafts()
      await fetchData()
      await fetchCohortStatus()
    } catch (error) {
      alert('Login failed. Please check your credentials.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('admin_token')
    setIsAuthenticated(false)
    setEvents([])
    setBlogs([])
    setMembers([])
    setApplicationsOpen(null)
  }

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-center">
          <p>Loading...</p>
        </div>
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <main className="min-h-screen bg-gray-50">
        <div className="max-w-md mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <Card>
            <CardHeader>
              <CardTitle className="text-center">Admin Login</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={loginForm.username}
                    onChange={(e) => setLoginForm({ ...loginForm, username: e.target.value })}
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={loginForm.password}
                    onChange={(e) => setLoginForm({ ...loginForm, password: e.target.value })}
                    required
                  />
                </div>
                <Button type="submit" className="w-full">Login</Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-gray-50">

      <section className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <h1 className="font-serif text-3xl font-bold text-gray-900">Admin Dashboard</h1>
            <Button variant="outline" onClick={handleLogout}>Logout</Button>
          </div>
        </div>
      </section>

      <section className="py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Tabs defaultValue="events" className="w-full">
            <TabsList className="grid w-full grid-cols-4 max-w-xl mb-8">
              <TabsTrigger value="events">Events ({events.length})</TabsTrigger>
              <TabsTrigger value="blogs">Blogs ({blogs.length})</TabsTrigger>
              <TabsTrigger value="members">Members ({members.length})</TabsTrigger>
              <TabsTrigger value="cohorts" onClick={fetchCohortStatus}>
                Cohorts
              </TabsTrigger>
            </TabsList>

            {/* ── Events Tab ────────────────────────────────────────────── */}
            <TabsContent value="events">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Manage Events</h2>
                  <Dialog open={isEventDialogOpen} onOpenChange={setIsEventDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setSelectedEvent(null)}>
                        <Plus className="h-4 w-4 mr-2" /> Add Event
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{selectedEvent ? 'Edit Event' : 'Create New Event'}</DialogTitle>
                      </DialogHeader>
                      <EventForm
                        event={selectedEvent}
                        onSave={(event) => {
                          if (selectedEvent) {
                            setEvents(events.map(e => e.id === event.id ? event : e))
                          } else {
                            setEvents([event, ...events])
                          }
                          setIsEventDialogOpen(false)
                          setSelectedEvent(null)
                        }}
                        onCancel={() => { setIsEventDialogOpen(false); setSelectedEvent(null) }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {events.map((event) => (
                    <EventAdminCard
                      key={event.id}
                      event={event}
                      onEdit={(event) => { setSelectedEvent(event); setIsEventDialogOpen(true) }}
                      onDelete={async (id) => {
                        if (confirm('Are you sure you want to delete this event?')) {
                          try { await adminApi.deleteEvent(id); setEvents(events.filter(e => e.id !== id)) }
                          catch { alert('Failed to delete event') }
                        }
                      }}
                    />
                  ))}
                </div>

                {events.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No events created yet.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Blogs Tab ─────────────────────────────────────────────── */}
            <TabsContent value="blogs">
              <div className="space-y-8">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Manage Blogs</h2>
                  <div className="flex gap-2">
                    <Dialog open={isBlogUrlDialogOpen} onOpenChange={setIsBlogUrlDialogOpen}>
                      <DialogTrigger asChild>
                        <Button variant="outline">
                          <LinkIcon className="h-4 w-4 mr-2" /> From URL
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader><DialogTitle>Create Blog from URL</DialogTitle></DialogHeader>
                        <BlogFromUrlForm
                          onSave={(blog) => { setBlogs([blog, ...blogs]); setIsBlogUrlDialogOpen(false) }}
                          onCancel={() => setIsBlogUrlDialogOpen(false)}
                        />
                      </DialogContent>
                    </Dialog>
                    <Button onClick={() => router.push('/admin/newblog')} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold">
                      <Plus className="h-4 w-4 mr-2" /> Add Blog
                    </Button>
                  </div>
                </div>

                {/* Saved Drafts Section */}
                {blogDrafts.length > 0 && (
                  <div className="space-y-4 p-5 rounded-xl bg-blue-50/40 border border-blue-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                          <FileText className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-base font-semibold text-gray-900">
                            Saved Drafts ({blogDrafts.length})
                          </h3>
                          <p className="text-xs text-gray-500">
                            Unpublished drafts saved on your computer. Click resume to continue writing.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {blogDrafts.map((draft) => {
                        const plainContent = draft.content ? draft.content.replace(/<[^>]*>/g, " ").trim() : ""
                        const displayExcerpt = draft.excerpt || plainContent || "No content preview available."
                        return (
                          <Card key={draft.id} className="bg-white border-blue-200/70 hover:border-blue-300 shadow-xs hover:shadow-md transition-all flex flex-col justify-between">
                            <CardHeader className="pb-2">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <div className="flex flex-wrap gap-1.5">
                                  <Badge variant="secondary" className="text-[11px] font-normal">
                                    {draft.category || "General"}
                                  </Badge>
                                  <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100 border-blue-200 text-[11px] font-medium">
                                    Draft
                                  </Badge>
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 text-gray-400 hover:text-red-600 hover:bg-red-50"
                                  onClick={() => handleDiscardDraft(draft.id)}
                                  title="Discard draft"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                              <CardTitle className="text-base leading-snug line-clamp-2 text-gray-900">
                                {draft.title || "Untitled Draft"}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="space-y-3 pt-0">
                              <p className="text-xs text-gray-600 line-clamp-2 leading-relaxed">
                                {displayExcerpt}
                              </p>
                              <div className="flex items-center justify-between text-[11px] text-gray-500 pt-2 border-t border-gray-100">
                                <span className="truncate max-w-[120px]">{draft.author || "Admin"}</span>
                                <span className="flex items-center gap-1 shrink-0">
                                  <Clock className="h-3 w-3 text-gray-400" />
                                  {formatDraftTime(draft.savedAt)}
                                </span>
                              </div>
                              <Button
                                size="sm"
                                className="w-full bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold h-8"
                                onClick={() => router.push(draft.blogId ? `/admin/newblog?id=${draft.blogId}&resumeDraft=true` : `/admin/newblog?draftId=${draft.id}&resumeDraft=true`)}
                              >
                                <Edit className="h-3.5 w-3.5 mr-1.5" /> Resume Draft
                              </Button>
                            </CardContent>
                          </Card>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Published Blogs Section */}
                <div>
                  <div className="mb-4">
                    <h3 className="text-base font-semibold text-gray-900">
                      Published Articles ({blogs.length})
                    </h3>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {blogs.map((blog) => (
                      <BlogAdminCard
                        key={blog.id}
                        blog={blog}
                        onEdit={(blog) => { router.push(`/admin/newblog?id=${blog.id}`) }}
                        onDelete={async (id) => {
                          if (confirm('Are you sure you want to delete this blog?')) {
                            try { await adminApi.deleteBlog(id); setBlogs(blogs.filter(b => b.id !== id)) }
                            catch { alert('Failed to delete blog') }
                          }
                        }}
                      />
                    ))}
                  </div>

                  {blogs.length === 0 && (
                    <div className="text-center py-12">
                      <p className="text-gray-500">No blogs created yet.</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            {/* ── Members Tab ───────────────────────────────────────────── */}
            <TabsContent value="members">
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold text-gray-900">Manage Members</h2>
                  <Dialog open={isMemberDialogOpen} onOpenChange={setIsMemberDialogOpen}>
                    <DialogTrigger asChild>
                      <Button onClick={() => setMember(null)}>
                        <Plus className="h-4 w-4 mr-2" /> Add Member
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>{selectedMember ? 'Edit Member' : 'Add Member'}</DialogTitle>
                      </DialogHeader>
                      <MemberForm
                        member={selectedMember}
                        onSave={(member) => {
                          if (selectedMember) {
                            setMembers(members.map(m => m.id === member.id ? member : m))
                          } else {
                            setMembers([member, ...members])
                          }
                          setIsMemberDialogOpen(false)
                          setMember(null)
                        }}
                        onCancel={() => { setIsMemberDialogOpen(false); setMember(null) }}
                      />
                    </DialogContent>
                  </Dialog>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {members.map((member) => (
                    <MemberAdminCard
                      key={member.id}
                      member={member}
                      onEdit={(member) => { setMember(member); setIsMemberDialogOpen(true) }}
                      onDelete={async (id) => {
                        if (confirm('Are you sure you want to delete this member?')) {
                          try { await adminApi.deleteMember(id); setMembers(members.filter(m => m.id !== id)) }
                          catch { alert('Failed to delete member') }
                        }
                      }}
                    />
                  ))}
                </div>

                {members.length === 0 && (
                  <div className="text-center py-12">
                    <p className="text-gray-500">No members registered yet.</p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* ── Cohorts Tab ───────────────────────────────────────────── */}
            <TabsContent value="cohorts">
              <div className="space-y-6">
                <h2 className="text-2xl font-bold text-gray-900">Manage Cohorts</h2>

                <Card className="max-w-xl">
                  <CardHeader className="border-b">
                    <div className="flex items-center gap-3">
                      <GraduationCap className="h-6 w-6 text-primary" />
                      <CardTitle>DEV-COHORT I — Applications</CardTitle>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-6 space-y-5">

                    {/* Status indicator */}
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-gray-600">Current status:</span>
                      {applicationsOpen === null ? (
                        <Badge variant="outline" className="text-gray-400">Loading...</Badge>
                      ) : applicationsOpen ? (
                        <Badge className="bg-green-500 hover:bg-green-600">
                          <LockOpen className="h-3 w-3 mr-1" /> Open
                        </Badge>
                      ) : (
                        <Badge className="bg-red-500 hover:bg-red-600">
                          <Lock className="h-3 w-3 mr-1" /> Closed
                        </Badge>
                      )}
                      {cohortStatusUpdatedAt && (
                        <span className="text-xs text-gray-400">
                          Last updated: {new Date(cohortStatusUpdatedAt).toLocaleString()}
                        </span>
                      )}
                    </div>

                    <p className="text-sm text-gray-500">
                      Closing applications will immediately disable the Register button on the cohort page
                      and block new form submissions from the backend.
                    </p>

                    {/* Toggle button */}
                    <div className="flex gap-3">
                      {applicationsOpen === false || applicationsOpen === null ? (
                        <Button
                          className="bg-green-600 hover:bg-green-700"
                          disabled={cohortToggleLoading || applicationsOpen === null}
                          onClick={() => toggleApplications("open")}
                        >
                          {cohortToggleLoading
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <LockOpen className="h-4 w-4 mr-2" />}
                          Open Applications
                        </Button>
                      ) : (
                        <Button
                          variant="destructive"
                          disabled={cohortToggleLoading}
                          onClick={() => toggleApplications("close")}
                        >
                          {cohortToggleLoading
                            ? <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            : <Lock className="h-4 w-4 mr-2" />}
                          Close Applications
                        </Button>
                      )}

                      <Button
                        variant="outline"
                        onClick={fetchCohortStatus}
                        disabled={cohortToggleLoading}
                      >
                        Refresh Status
                      </Button>
                    </div>

                    <Separator />

                    {/* Export applicants */}
                    <div>
                      <p className="text-sm font-medium text-gray-700 mb-3">Export Applicants</p>
                      <Button
                        variant="outline"
                        onClick={async () => {
                          try {
                            const res = await fetch(`${API_BASE}/cohorts/applications/export`, {
                              headers: {
                                Authorization: `Bearer ${localStorage.getItem("admin_token")}`,
                              },
                            })
                            if (!res.ok) throw new Error("Export failed")
                            const blob = await res.blob()
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement("a")
                            a.href = url
                            a.download = `cohort_applicants_${new Date().toISOString().slice(0, 10)}.xlsx`
                            a.click()
                            URL.revokeObjectURL(url)
                          } catch {
                            alert("Failed to export applicants.")
                          }
                        }}
                      >
                        <Download className="h-4 w-4 mr-2" />
                        Download Applicants (.xlsx)
                      </Button>
                      <p className="text-xs text-gray-400 mt-2">
                        Downloads all submitted applicant details as a formatted Excel file.
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

          </Tabs>
        </div>
      </section>

    </main>
  )
}

// ── Event Admin Card ──────────────────────────────────────────────────────────
function EventAdminCard({
  event, onEdit, onDelete
}: {
  event: Event
  onEdit: (event: Event) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Badge variant={event.status === 'upcoming' ? 'default' : 'secondary'}>{event.type}</Badge>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(event)}><Edit className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => onDelete(event.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <CardTitle className="text-lg leading-tight">{event.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center"><Calendar className="h-4 w-4 mr-2" />{formatDate(event.date)} at {event.time}</div>
          <div className="flex items-center"><MapPin className="h-4 w-4 mr-2" />{event.location}</div>
          <div className="flex items-center"><Users className="h-4 w-4 mr-2" />{event.attendees}/{event.max_attendees} attendees</div>
        </div>
        <p className="text-sm text-gray-700 mb-4 line-clamp-3">{event.description}</p>
        <Button asChild size="sm" variant="outline" className="w-full">
          <a href={`/events/${event.id}`} target="_blank"><Eye className="h-4 w-4 mr-2" />View Live</a>
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Blog Admin Card ───────────────────────────────────────────────────────────
function BlogAdminCard({
  blog, onEdit, onDelete
}: {
  blog: Blog
  onEdit: (blog: Blog) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            <Badge variant="secondary">{blog.category}</Badge>
            {blog.featured && <Badge>Featured</Badge>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(blog)}><Edit className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => onDelete(blog.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <CardTitle className="text-lg leading-tight">{blog.title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center"><BookOpen className="h-4 w-4 mr-2" />{blog.author} • {blog.read_time}</div>
          <div className="flex items-center"><Tags className="h-4 w-4 mr-2" />{blog.tags.join(', ')}</div>
        </div>
        <p className="text-sm text-gray-700 mb-4 line-clamp-3">{blog.excerpt}</p>
        <Button asChild size="sm" variant="outline" className="w-full">
          <a href={`/blog/${blog.id}`} target="_blank"><Eye className="h-4 w-4 mr-2" />View Live</a>
        </Button>
      </CardContent>
    </Card>
  )
}

// ── Member Admin Card ─────────────────────────────────────────────────────────
function MemberAdminCard({
  member, onEdit, onDelete
}: {
  member: Member
  onEdit: (member: Member) => void
  onDelete: (id: string) => void
}) {
  return (
    <Card className="hover:shadow-lg transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex gap-2">
            <Badge variant="secondary">{member.department}</Badge>
            {member.featured && <Badge>Featured</Badge>}
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => onEdit(member)}><Edit className="h-4 w-4" /></Button>
            <Button size="sm" variant="outline" onClick={() => onDelete(member.id)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        </div>
        <CardTitle className="text-lg leading-tight">{member.first_name} {member.last_name}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-2 text-sm text-gray-600 mb-4">
          <div className="flex items-center"><Users className="h-4 w-4 mr-2" />{member.role || "Member"} • {member.level}</div>
          <div className="flex items-center"><BookOpen className="h-4 w-4 mr-2" />{member.projects} Projects • {member.events_attended} Events</div>
          <div className="flex items-center"><Tags className="h-4 w-4 mr-2" />{(member.achievements || []).join(', ') || "No achievements"}</div>
        </div>
      </CardContent>
    </Card>
  )
}

// ── Event Form ────────────────────────────────────────────────────────────────
function EventForm({
  event, onSave, onCancel
}: {
  event: Event | null
  onSave: (event: Event) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    title: event?.title || '',
    description: event?.description || '',
    full_description: event?.full_description || '',
    date: event?.date || '',
    time: event?.time || '',
    location: event?.location || '',
    type: event?.type || '',
    max_attendees: event?.max_attendees || 50,
    speaker_name: event?.speaker_name || '',
    speaker_title: event?.speaker_title || '',
    speaker_bio: event?.speaker_bio || '',
    status: event?.status || 'upcoming'
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const savedEvent = event
        ? await adminApi.updateEvent(event.id, formData)
        : await adminApi.createEvent(formData as any)
      onSave(savedEvent)
    } catch {
      alert('Failed to save event')
    }
  }

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-2">
          {event ? 'Update Event' : 'Create New Event'}
        </h2>
        <p className="text-gray-600 text-sm sm:text-base">
          Fill in the details below to {event ? 'update' : 'create'} your blockchain event
        </p>
      </div>

      <div className="space-y-6 sm:space-y-8">
        <Card>
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center text-gray-900">
              <Calendar className="w-5 h-5 mr-2 text-blue-600" /> Event Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div>
                <Label htmlFor="title">Event Title *</Label>
                <Input id="title" value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="Enter event title" required />
              </div>
              <div>
                <Label htmlFor="description">Short Description *</Label>
                <Textarea id="description" value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="Brief description for event preview" rows={3} required />
              </div>
              <div>
                <Label htmlFor="full_description">Full Description</Label>
                <Textarea id="full_description" value={formData.full_description} onChange={(e) => setFormData({ ...formData, full_description: e.target.value })} placeholder="Detailed event description..." rows={6} />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label htmlFor="date" className="flex items-center"><Calendar className="w-4 h-4 mr-1" />Date *</Label>
                  <Input id="date" type="date" value={formData.date} onChange={(e) => setFormData({ ...formData, date: e.target.value })} required />
                </div>
                <div>
                  <Label htmlFor="time" className="flex items-center"><Clock className="w-4 h-4 mr-1" />Time *</Label>
                  <Input id="time" value={formData.time} onChange={(e) => setFormData({ ...formData, time: e.target.value })} placeholder="e.g., 2:00 PM - 5:00 PM" required />
                </div>
              </div>
              <div>
                <Label htmlFor="location" className="flex items-center"><MapPin className="w-4 h-4 mr-1" />Location *</Label>
                <Input id="location" value={formData.location} onChange={(e) => setFormData({ ...formData, location: e.target.value })} placeholder="Venue name or online platform" required />
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label htmlFor="type">Event Type *</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger><SelectValue placeholder="Select event type" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Workshop">Workshop</SelectItem>
                      <SelectItem value="Seminar">Seminar</SelectItem>
                      <SelectItem value="Webinar">Webinar</SelectItem>
                      <SelectItem value="Hackathon">Hackathon</SelectItem>
                      <SelectItem value="Panel Discussion">Panel Discussion</SelectItem>
                      <SelectItem value="Networking">Networking Event</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="max_attendees" className="flex items-center"><Users className="w-4 h-4 mr-1" />Max Attendees *</Label>
                  <Input id="max_attendees" type="number" value={formData.max_attendees} onChange={(e) => setFormData({ ...formData, max_attendees: parseInt(e.target.value) || 0 })} placeholder="e.g., 50" min="1" required />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Separator />

        <Card>
          <CardHeader className="border-b border-gray-100">
            <CardTitle className="flex items-center text-gray-900">
              <User className="w-5 h-5 mr-2 text-green-600" /> Speaker Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div>
                  <Label htmlFor="speaker_name">Speaker Name *</Label>
                  <Input id="speaker_name" value={formData.speaker_name} onChange={(e) => setFormData({ ...formData, speaker_name: e.target.value })} placeholder="Full name of the speaker" required />
                </div>
                <div>
                  <Label htmlFor="speaker_title" className="flex items-center"><AwardIcon className="w-4 h-4 mr-1" />Speaker Title/Position</Label>
                  <Input id="speaker_title" value={formData.speaker_title} onChange={(e) => setFormData({ ...formData, speaker_title: e.target.value })} placeholder="e.g., Blockchain Developer, CEO" />
                </div>
              </div>
              <div>
                <Label htmlFor="speaker_bio">Speaker Bio</Label>
                <Textarea id="speaker_bio" value={formData.speaker_bio} onChange={(e) => setFormData({ ...formData, speaker_bio: e.target.value })} placeholder="Brief biography and expertise of the speaker" rows={4} />
              </div>
            </div>
          </CardContent>
        </Card>

        {event && (
          <Card>
            <CardHeader className="border-b border-gray-100">
              <CardTitle className="text-gray-900">Event Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="max-w-md">
                <Label htmlFor="status">Current Status</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value as "upcoming" | "past" | "cancelled" })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="upcoming">Upcoming</SelectItem>
                    <SelectItem value="past">Past</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 pt-4 sm:pt-6">
          <Button onClick={handleSubmit} className="flex-1 order-2 sm:order-1">
            {event ? 'Update Event' : 'Create Event'}
          </Button>
          <Button variant="outline" onClick={onCancel} className="flex-1 order-1 sm:order-2">Cancel</Button>
        </div>
      </div>
    </div>
  )
}

// ── Blog Form ─────────────────────────────────────────────────────────────────
function BlogForm({
  blog, onSave, onCancel
}: {
  blog: Blog | null
  onSave: (blog: Blog) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    title: blog?.title || '',
    excerpt: blog?.excerpt || '',
    content: blog?.content || '',
    author: blog?.author || '',
    author_bio: blog?.author_bio || '',
    category: blog?.category || '',
    tags: blog?.tags.join(', ') || '',
    featured: blog?.featured || false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const blogData = { ...formData, tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean) }
      const savedBlog = blog
        ? await adminApi.updateBlog(blog.id, blogData)
        : await adminApi.createBlog(blogData as any)
      onSave(savedBlog)
    } catch {
      alert('Failed to save blog')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Title</Label>
        <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} required />
      </div>
      <div>
        <Label>Excerpt</Label>
        <Textarea value={formData.excerpt} onChange={(e) => setFormData({ ...formData, excerpt: e.target.value })} required />
      </div>
      <div>
        <Label>Content</Label>
        <Textarea value={formData.content} onChange={(e) => setFormData({ ...formData, content: e.target.value })} rows={12} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Author</Label>
          <Input value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} required />
        </div>
        <div>
          <Label>Category</Label>
          <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
            <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="Education">Education</SelectItem>
              <SelectItem value="News">News</SelectItem>
              <SelectItem value="Industry">Industry</SelectItem>
              <SelectItem value="Workshop">Workshop</SelectItem>
              <SelectItem value="Security">Security</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Author Bio</Label>
        <Textarea value={formData.author_bio} onChange={(e) => setFormData({ ...formData, author_bio: e.target.value })} />
      </div>
      <div>
        <Label>Tags (comma-separated)</Label>
        <Input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="React, JavaScript, Web Development" />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="featured" checked={formData.featured} onCheckedChange={(v) => setFormData({ ...formData, featured: v as boolean })} />
        <Label htmlFor="featured">Featured Article</Label>
      </div>
      <div className="flex gap-4 pt-4">
        <Button type="submit" className="flex-1">{blog ? 'Update Blog' : 'Create Blog'}</Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
      </div>
    </form>
  )
}

// ── Blog from URL Form ────────────────────────────────────────────────────────
function BlogFromUrlForm({
  onSave, onCancel
}: {
  onSave: (blog: Blog) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({ url: '', author: '', category: '', tags: '', featured: false })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const blogData = { ...formData, author_bio: '', tags: formData.tags.split(',').map(t => t.trim()).filter(Boolean) }
      const savedBlog = await adminApi.createBlogFromUrl(blogData)
      onSave(savedBlog)
    } catch {
      alert('Failed to create blog from URL')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <Label>Article URL</Label>
        <Input type="url" value={formData.url} onChange={(e) => setFormData({ ...formData, url: e.target.value })} placeholder="https://example.com/article" required />
      </div>
      <div>
        <Label>Author</Label>
        <Input value={formData.author} onChange={(e) => setFormData({ ...formData, author: e.target.value })} required />
      </div>
      <div>
        <Label>Category</Label>
        <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
          <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="Education">Education</SelectItem>
            <SelectItem value="News">News</SelectItem>
            <SelectItem value="Industry">Industry</SelectItem>
            <SelectItem value="Workshop">Workshop</SelectItem>
            <SelectItem value="Security">Security</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>Tags (comma-separated)</Label>
        <Input value={formData.tags} onChange={(e) => setFormData({ ...formData, tags: e.target.value })} placeholder="Blockchain, Crypto, DeFi" />
      </div>
      <div className="flex items-center space-x-2">
        <Checkbox id="featured" checked={formData.featured} onCheckedChange={(v) => setFormData({ ...formData, featured: v as boolean })} />
        <Label htmlFor="featured">Featured Article</Label>
      </div>
      <div className="flex gap-4 pt-4">
        <Button type="submit" className="flex-1">Create Blog</Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
      </div>
    </form>
  )
}

// ── Member Form ───────────────────────────────────────────────────────────────
function MemberForm({
  member, onSave, onCancel
}: {
  member: Member | null
  onSave: (member: Member) => void
  onCancel: () => void
}) {
  const [formData, setFormData] = useState({
    first_name: member?.first_name || '',
    last_name: member?.last_name || '',
    email: member?.email || '',
    student_id: member?.student_id || '',
    department: member?.department || '',
    level: member?.level || '',
    phone: member?.phone || '',
    interests: member?.interests.join(', ') || '',
    experience: member?.experience || '',
    goals: member?.goals || '',
    newsletter: member?.newsletter || false,
    terms: member?.terms || true,
    role: member?.role || '',
    avatar: member?.avatar || '',
    projects: member?.projects || 0,
    events_attended: member?.events_attended || 0,
    achievements: member?.achievements.join(', ') || '',
    featured: member?.featured || false
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const memberData = {
        ...formData,
        interests: formData.interests.split(',').map(i => i.trim()).filter(Boolean),
        achievements: formData.achievements.split(',').map(i => i.trim()).filter(Boolean),
        projects: parseInt(formData.projects.toString()),
        events_attended: parseInt(formData.events_attended.toString())
      }
      const savedMember = member
        ? await adminApi.updateMember(member.id, memberData)
        : await memberApi.createMember(memberData as any)
      onSave(savedMember)
    } catch {
      alert('Failed to save member')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>First Name</Label>
          <Input value={formData.first_name} onChange={(e) => setFormData({ ...formData, first_name: e.target.value })} required />
        </div>
        <div>
          <Label>Last Name</Label>
          <Input value={formData.last_name} onChange={(e) => setFormData({ ...formData, last_name: e.target.value })} required />
        </div>
      </div>
      <div>
        <Label>Email</Label>
        <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} required />
      </div>
      <div>
        <Label>Student ID</Label>
        <Input value={formData.student_id} onChange={(e) => setFormData({ ...formData, student_id: e.target.value })} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Department</Label>
          <Input value={formData.department} onChange={(e) => setFormData({ ...formData, department: e.target.value })} required />
        </div>
        <div>
          <Label>Level</Label>
          <Select value={formData.level} onValueChange={(v) => setFormData({ ...formData, level: v })}>
            <SelectTrigger><SelectValue placeholder="Select level" /></SelectTrigger>
            <SelectContent>
              {["100","200","300","400","500"].map(l => <SelectItem key={l} value={l}>{l} Level</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>Phone</Label>
        <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} />
      </div>
      <div>
        <Label>Interests (comma-separated)</Label>
        <Input value={formData.interests} onChange={(e) => setFormData({ ...formData, interests: e.target.value })} placeholder="Blockchain, Smart Contracts, DeFi" />
      </div>
      <div>
        <Label>Experience</Label>
        <Textarea value={formData.experience} onChange={(e) => setFormData({ ...formData, experience: e.target.value })} required />
      </div>
      <div>
        <Label>Goals</Label>
        <Textarea value={formData.goals} onChange={(e) => setFormData({ ...formData, goals: e.target.value })} />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Role</Label>
          <Input value={formData.role} onChange={(e) => setFormData({ ...formData, role: e.target.value })} placeholder="e.g., Developer, Organizer" />
        </div>
        <div>
          <Label>Avatar URL</Label>
          <Input value={formData.avatar} onChange={(e) => setFormData({ ...formData, avatar: e.target.value })} />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Projects</Label>
          <Input type="number" value={formData.projects} onChange={(e) => setFormData({ ...formData, projects: parseInt(e.target.value) || 0 })} />
        </div>
        <div>
          <Label>Events Attended</Label>
          <Input type="number" value={formData.events_attended} onChange={(e) => setFormData({ ...formData, events_attended: parseInt(e.target.value) || 0 })} />
        </div>
      </div>
      <div>
        <Label>Achievements (comma-separated)</Label>
        <Input value={formData.achievements} onChange={(e) => setFormData({ ...formData, achievements: e.target.value })} />
      </div>
      <div className="space-y-2">
        {[
          { id: "newsletter", label: "Subscribe to Newsletter", key: "newsletter" },
          { id: "terms", label: "Agree to Terms", key: "terms" },
          { id: "featured", label: "Featured Member", key: "featured" },
        ].map(({ id, label, key }) => (
          <div key={id} className="flex items-center space-x-2">
            <Checkbox id={id} checked={formData[key as keyof typeof formData] as boolean} onCheckedChange={(v) => setFormData({ ...formData, [key]: v as boolean })} />
            <Label htmlFor={id}>{label}</Label>
          </div>
        ))}
      </div>
      <div className="flex gap-4 pt-4">
        <Button type="submit" className="flex-1">{member ? 'Update Member' : 'Create Member'}</Button>
        <Button type="button" variant="outline" onClick={onCancel} className="flex-1">Cancel</Button>
      </div>
    </form>
  )
}