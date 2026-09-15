"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import type { Note } from "@/lib/types";
import Editor from "./Editor";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchNotes = useCallback(async () => {
    if (!user) return;
    const { data } = await getSupabase()
      .from("notes")
      .select("*")
      .eq("user_id", user.id)
      .order("updated_at", { ascending: false });
    setNotes(data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  const createNote = async () => {
    if (!user) return;
    const { data } = await getSupabase()
      .from("notes")
      .insert({ user_id: user.id, title: "Untitled", scene: "{}" })
      .select()
      .single();
    if (data) {
      setNotes((prev) => [data, ...prev]);
      setActiveNoteId(data.id);
    }
  };

  const deleteNote = async (id: string) => {
    await getSupabase().from("notes").delete().eq("id", id);
    setNotes((prev) => prev.filter((n) => n.id !== id));
    if (activeNoteId === id) setActiveNoteId(null);
  };

  const renameNote = async (id: string, title: string) => {
    await getSupabase().from("notes").update({ title }).eq("id", id);
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, title } : n)));
  };

  if (activeNoteId) {
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return null;
    return (
      <Editor
        note={note}
        onBack={() => {
          fetchNotes();
          setActiveNoteId(null);
        }}
        onRename={(title) => renameNote(note.id, title)}
      />
    );
  }

  const filtered = notes.filter((n) =>
    n.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
      {/* Header */}
      <header
        className="sticky top-0 z-10 backdrop-blur-md border-b px-4 py-3 flex items-center justify-between"
        style={{
          borderColor: "var(--border)",
          background: "color-mix(in srgb, var(--background) 80%, transparent)",
        }}
      >
        <h1 className="text-lg font-bold">Notesapp</h1>
        <div className="flex items-center gap-2">
          <span
            className="text-xs hidden sm:inline"
            style={{ color: "var(--muted)" }}
          >
            {user?.email}
          </span>
          <button
            onClick={signOut}
            className="text-xs px-3 py-1.5 rounded-lg cursor-pointer"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-3xl mx-auto px-4 py-6">
        {/* Actions */}
        <div className="flex items-center gap-3 mb-6">
          <input
            type="text"
            placeholder="Search notes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 px-4 py-2.5 rounded-lg text-sm outline-none"
            style={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
            }}
          />
          <button
            onClick={createNote}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer whitespace-nowrap"
            style={{ background: "var(--accent)" }}
          >
            + New
          </button>
        </div>

        {/* Notes grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="animate-spin rounded-full h-6 w-6 border-b-2"
              style={{ borderColor: "var(--accent)" }}
            />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20" style={{ color: "var(--muted)" }}>
            {notes.length === 0
              ? 'No notes yet. Click "+ New" to create one.'
              : "No matching notes."}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {filtered.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                onClick={() => setActiveNoteId(note.id)}
                onDelete={() => deleteNote(note.id)}
                onRename={(title) => renameNote(note.id, title)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function NoteCard({
  note,
  onClick,
  onDelete,
  onRename,
}: {
  note: Note;
  onClick: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);

  const timeAgo = formatTimeAgo(note.updated_at);

  return (
    <div
      role="button"
      tabIndex={0}
      className="rounded-xl p-4 cursor-pointer transition-colors"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
      }}
      onClick={onClick}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--card-hover)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "var(--card)")
      }
    >
      <div className="flex items-start justify-between gap-2">
        {editing ? (
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (title.trim() && title !== note.title) onRename(title.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="text-sm font-medium bg-transparent border-none outline-none flex-1"
            style={{ color: "var(--foreground)" }}
          />
        ) : (
          <span className="text-sm font-medium truncate flex-1">
            {note.title}
          </span>
        )}

        <div className="flex gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded cursor-pointer bg-transparent border-none"
            style={{ color: "var(--muted)" }}
            title="Rename"
          >
            ✎
          </button>
          <button
            onClick={() => {
              if (confirm("Delete this note?")) onDelete();
            }}
            className="text-xs px-2 py-1 rounded cursor-pointer bg-transparent border-none"
            style={{ color: "var(--danger)" }}
            title="Delete"
          >
            ✕
          </button>
        </div>
      </div>
      <p className="text-xs mt-2" style={{ color: "var(--muted)" }}>
        {timeAgo}
      </p>
    </div>
  );
}

function formatTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}
