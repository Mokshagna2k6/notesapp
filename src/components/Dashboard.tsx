"use client";

import { useEffect, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import { useAuth } from "./AuthProvider";
import type { Note, Folder } from "@/lib/types";
import Editor from "./Editor";

export default function Dashboard() {
  const { user, signOut } = useAuth();
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [activeNoteId, setActiveNoteId] = useState<string | null>(null);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const fetchAll = useCallback(async () => {
    if (!user) return;
    const [notesRes, foldersRes] = await Promise.all([
      getSupabase()
        .from("notes")
        .select("*")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false }),
      getSupabase()
        .from("folders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: true }),
    ]);
    setNotes(notesRes.data ?? []);
    setFolders(foldersRes.data ?? []);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const createNote = async (folderId: string | null = activeFolderId) => {
    if (!user) return;
    const { data } = await getSupabase()
      .from("notes")
      .insert({
        user_id: user.id,
        title: "Untitled",
        scene: "{}",
        folder_id: folderId,
      })
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

  const moveNote = async (noteId: string, folderId: string | null) => {
    await getSupabase().from("notes").update({ folder_id: folderId }).eq("id", noteId);
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, folder_id: folderId } : n))
    );
  };

  const createFolder = async () => {
    if (!user || !newFolderName.trim()) return;
    const { data } = await getSupabase()
      .from("folders")
      .insert({ user_id: user.id, name: newFolderName.trim() })
      .select()
      .single();
    if (data) {
      setFolders((prev) => [...prev, data]);
      setNewFolderName("");
      setCreatingFolder(false);
    }
  };

  const renameFolder = async (id: string, name: string) => {
    await getSupabase().from("folders").update({ name }).eq("id", id);
    setFolders((prev) => prev.map((f) => (f.id === id ? { ...f, name } : f)));
  };

  const deleteFolder = async (id: string) => {
    await getSupabase().from("notes").update({ folder_id: null }).eq("folder_id", id);
    await getSupabase().from("folders").delete().eq("id", id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setNotes((prev) =>
      prev.map((n) => (n.folder_id === id ? { ...n, folder_id: null } : n))
    );
    if (activeFolderId === id) setActiveFolderId(null);
  };

  if (activeNoteId) {
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return null;
    return (
      <Editor
        note={note}
        onBack={() => {
          fetchAll();
          setActiveNoteId(null);
        }}
        onRename={(title) => renameNote(note.id, title)}
      />
    );
  }

  const visibleNotes = notes.filter((n) => {
    const matchesFolder =
      activeFolderId === null
        ? true
        : activeFolderId === "unfiled"
          ? !n.folder_id
          : n.folder_id === activeFolderId;
    const matchesSearch = n.title.toLowerCase().includes(search.toLowerCase());
    return matchesFolder && matchesSearch;
  });

  const unfolderedCount = notes.filter((n) => !n.folder_id).length;

  return (
    <div className="min-h-screen" style={{ background: "var(--background)" }}>
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

      <div className="max-w-4xl mx-auto px-4 py-6">
        <div className="flex items-center gap-3 mb-4">
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
            onClick={() => createNote()}
            className="px-4 py-2.5 rounded-lg text-sm font-medium text-white cursor-pointer whitespace-nowrap"
            style={{ background: "var(--accent)" }}
          >
            + New
          </button>
        </div>

        {/* Folder bar */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveFolderId(null)}
            className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none"
            style={{
              background: activeFolderId === null ? "var(--accent)" : "var(--card)",
              color: activeFolderId === null ? "#fff" : "var(--foreground)",
              border: `1px solid ${activeFolderId === null ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            All ({notes.length})
          </button>
          <button
            onClick={() => setActiveFolderId("unfiled")}
            className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none"
            style={{
              background: activeFolderId === "unfiled" ? "var(--accent)" : "var(--card)",
              color: activeFolderId === "unfiled" ? "#fff" : "var(--foreground)",
              border: `1px solid ${activeFolderId === "unfiled" ? "var(--accent)" : "var(--border)"}`,
            }}
          >
            Unfiled ({unfolderedCount})
          </button>
          {folders.map((f) => (
            <FolderChip
              key={f.id}
              folder={f}
              active={activeFolderId === f.id}
              count={notes.filter((n) => n.folder_id === f.id).length}
              onClick={() => setActiveFolderId(f.id)}
              onRename={(name) => renameFolder(f.id, name)}
              onDelete={() => deleteFolder(f.id)}
            />
          ))}
          {creatingFolder ? (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                createFolder();
              }}
              className="flex items-center gap-1"
            >
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="Folder name"
                autoFocus
                onBlur={() => {
                  if (!newFolderName.trim()) setCreatingFolder(false);
                }}
                className="px-2 py-1 rounded text-xs outline-none"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--accent)",
                  color: "var(--foreground)",
                  width: 120,
                }}
              />
            </form>
          ) : (
            <button
              onClick={() => setCreatingFolder(true)}
              className="px-3 py-1.5 rounded-lg text-xs cursor-pointer"
              style={{
                background: "transparent",
                border: "1px dashed var(--border)",
                color: "var(--muted)",
              }}
            >
              + Folder
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="animate-spin rounded-full h-6 w-6 border-b-2"
              style={{ borderColor: "var(--accent)" }}
            />
          </div>
        ) : visibleNotes.length === 0 ? (
          <div className="text-center py-20" style={{ color: "var(--muted)" }}>
            {notes.length === 0
              ? 'No notes yet. Click "+ New" to create one.'
              : activeFolderId && !search
                ? "This folder is empty."
                : "No matching notes."}
          </div>
        ) : (
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
            {visibleNotes.map((note) => (
              <NoteCard
                key={note.id}
                note={note}
                folders={folders}
                onClick={() => setActiveNoteId(note.id)}
                onDelete={() => deleteNote(note.id)}
                onRename={(title) => renameNote(note.id, title)}
                onMove={(folderId) => moveNote(note.id, folderId)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FolderChip({
  folder,
  active,
  count,
  onClick,
  onRename,
  onDelete,
}: {
  folder: Folder;
  active: boolean;
  count: number;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setShowMenu(!showMenu);
        }}
        className="px-3 py-1.5 rounded-lg text-xs cursor-pointer border-none flex items-center gap-1"
        style={{
          background: active ? "var(--accent)" : "var(--card)",
          color: active ? "#fff" : "var(--foreground)",
          border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
        }}
      >
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              setEditing(false);
              if (name.trim() && name !== folder.name) onRename(name.trim());
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
            onClick={(e) => e.stopPropagation()}
            autoFocus
            className="bg-transparent border-none outline-none text-xs"
            style={{ color: "inherit", width: 80 }}
          />
        ) : (
          <>
            {folder.name} ({count})
          </>
        )}
        <span
          onClick={(e) => {
            e.stopPropagation();
            setShowMenu(!showMenu);
          }}
          style={{ marginLeft: 4, opacity: 0.6, fontSize: 10 }}
        >
          ...
        </span>
      </button>
      {showMenu && (
        <div
          className="absolute top-full left-0 mt-1 rounded-lg shadow-lg py-1 z-20"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            minWidth: 100,
          }}
        >
          <button
            onClick={() => {
              setShowMenu(false);
              setEditing(true);
            }}
            className="block w-full text-left px-3 py-1.5 text-xs cursor-pointer bg-transparent border-none"
            style={{ color: "var(--foreground)" }}
          >
            Rename
          </button>
          <button
            onClick={() => {
              setShowMenu(false);
              if (confirm("Delete folder? Notes will be moved to unfiled."))
                onDelete();
            }}
            className="block w-full text-left px-3 py-1.5 text-xs cursor-pointer bg-transparent border-none"
            style={{ color: "var(--danger)" }}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

function NoteCard({
  note,
  folders,
  onClick,
  onDelete,
  onRename,
  onMove,
}: {
  note: Note;
  folders: Folder[];
  onClick: () => void;
  onDelete: () => void;
  onRename: (title: string) => void;
  onMove: (folderId: string | null) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [showMoveMenu, setShowMoveMenu] = useState(false);

  const timeAgo = formatTimeAgo(note.updated_at);
  const folderName = folders.find((f) => f.id === note.folder_id)?.name;

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

        <div
          className="flex gap-1 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <button
            onClick={() => setEditing(true)}
            className="text-xs px-2 py-1 rounded cursor-pointer bg-transparent border-none"
            style={{ color: "var(--muted)" }}
            title="Rename"
          >
            ✎
          </button>
          <div className="relative">
            <button
              onClick={() => setShowMoveMenu(!showMoveMenu)}
              className="text-xs px-2 py-1 rounded cursor-pointer bg-transparent border-none"
              style={{ color: "var(--muted)" }}
              title="Move to folder"
            >
              ↪
            </button>
            {showMoveMenu && (
              <div
                className="absolute right-0 top-full mt-1 rounded-lg shadow-lg py-1 z-20"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  minWidth: 120,
                }}
              >
                <button
                  onClick={() => {
                    onMove(null);
                    setShowMoveMenu(false);
                  }}
                  className="block w-full text-left px-3 py-1.5 text-xs cursor-pointer bg-transparent border-none"
                  style={{
                    color: !note.folder_id ? "var(--accent)" : "var(--foreground)",
                  }}
                >
                  Unfiled
                </button>
                {folders.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => {
                      onMove(f.id);
                      setShowMoveMenu(false);
                    }}
                    className="block w-full text-left px-3 py-1.5 text-xs cursor-pointer bg-transparent border-none"
                    style={{
                      color:
                        note.folder_id === f.id
                          ? "var(--accent)"
                          : "var(--foreground)",
                    }}
                  >
                    {f.name}
                  </button>
                ))}
              </div>
            )}
          </div>
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
      <div className="flex items-center gap-2 mt-2">
        <p className="text-xs" style={{ color: "var(--muted)" }}>
          {timeAgo}
        </p>
        {folderName && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{
              background: "var(--border)",
              color: "var(--muted)",
              fontSize: 10,
            }}
          >
            {folderName}
          </span>
        )}
      </div>
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
