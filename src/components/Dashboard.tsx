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
  const [openFolderId, setOpenFolderId] = useState<string | null>(null);
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

  const createNote = async () => {
    if (!user) return;
    const { data } = await getSupabase()
      .from("notes")
      .insert({
        user_id: user.id,
        title: "Untitled",
        scene: "{}",
        folder_id: openFolderId,
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
    await getSupabase()
      .from("notes")
      .update({ folder_id: folderId })
      .eq("id", noteId);
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
    await getSupabase()
      .from("notes")
      .update({ folder_id: null })
      .eq("folder_id", id);
    await getSupabase().from("folders").delete().eq("id", id);
    setFolders((prev) => prev.filter((f) => f.id !== id));
    setNotes((prev) =>
      prev.map((n) => (n.folder_id === id ? { ...n, folder_id: null } : n))
    );
    if (openFolderId === id) setOpenFolderId(null);
  };

  if (activeNoteId) {
    const note = notes.find((n) => n.id === activeNoteId);
    if (!note) return null;
    return (
      <Editor
        note={note}
        allNotes={notes}
        folders={folders}
        onBack={() => {
          fetchAll();
          setActiveNoteId(null);
        }}
        onRename={(title) => renameNote(note.id, title)}
        onSwitchNote={(id) => setActiveNoteId(id)}
      />
    );
  }

  const currentFolderNotes = openFolderId
    ? notes.filter((n) => n.folder_id === openFolderId)
    : notes.filter((n) => !n.folder_id);

  const filteredNotes = search
    ? notes.filter((n) =>
        n.title.toLowerCase().includes(search.toLowerCase())
      )
    : currentFolderNotes;

  const currentFolder = folders.find((f) => f.id === openFolderId);

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
        {/* Search + New */}
        <div className="flex items-center gap-3 mb-4">
          <input
            type="text"
            placeholder={
              search
                ? "Search all notes..."
                : openFolderId
                  ? `Search in ${currentFolder?.name}...`
                  : "Search all notes..."
            }
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
            + New Note
          </button>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-5">
          <button
            onClick={() => {
              setOpenFolderId(null);
              setSearch("");
            }}
            className="text-sm cursor-pointer bg-transparent border-none"
            style={{
              color: openFolderId ? "var(--accent)" : "var(--foreground)",
              fontWeight: openFolderId ? 400 : 600,
            }}
          >
            My Notes
          </button>
          {currentFolder && (
            <>
              <span style={{ color: "var(--muted)" }}>/</span>
              <span className="text-sm font-semibold">
                {currentFolder.name}
              </span>
            </>
          )}
          {search && (
            <>
              <span style={{ color: "var(--muted)" }}>/</span>
              <span className="text-sm" style={{ color: "var(--muted)" }}>
                Search: &quot;{search}&quot;
              </span>
            </>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="animate-spin rounded-full h-6 w-6 border-b-2"
              style={{ borderColor: "var(--accent)" }}
            />
          </div>
        ) : (
          <>
            {/* Folders section — only show at root level, not when searching */}
            {!openFolderId && !search && (
              <div className="mb-6">
                <div className="flex items-center justify-between mb-3">
                  <h2
                    className="text-xs font-semibold uppercase tracking-wider"
                    style={{ color: "var(--muted)" }}
                  >
                    Folders
                  </h2>
                </div>
                <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 md:grid-cols-4">
                  {folders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      noteCount={
                        notes.filter((n) => n.folder_id === folder.id).length
                      }
                      onClick={() => setOpenFolderId(folder.id)}
                      onRename={(name) => renameFolder(folder.id, name)}
                      onDelete={() => deleteFolder(folder.id)}
                    />
                  ))}
                  {/* Create folder card */}
                  {creatingFolder ? (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        createFolder();
                      }}
                      className="rounded-xl p-4 flex flex-col items-center justify-center"
                      style={{
                        border: "2px dashed var(--accent)",
                        background: "var(--card)",
                        minHeight: 100,
                      }}
                    >
                      <input
                        value={newFolderName}
                        onChange={(e) => setNewFolderName(e.target.value)}
                        placeholder="Folder name..."
                        autoFocus
                        onBlur={() => {
                          if (newFolderName.trim()) {
                            createFolder();
                          } else {
                            setCreatingFolder(false);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Escape") setCreatingFolder(false);
                        }}
                        className="text-sm text-center bg-transparent border-none outline-none w-full"
                        style={{ color: "var(--foreground)" }}
                      />
                    </form>
                  ) : (
                    <button
                      onClick={() => setCreatingFolder(true)}
                      className="rounded-xl p-4 flex flex-col items-center justify-center gap-2 cursor-pointer"
                      style={{
                        border: "2px dashed var(--border)",
                        background: "transparent",
                        minHeight: 100,
                        color: "var(--muted)",
                      }}
                    >
                      <span style={{ fontSize: 24 }}>+</span>
                      <span className="text-xs">New Folder</span>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Notes section */}
            <div>
              <h2
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{ color: "var(--muted)" }}
              >
                {search
                  ? `Search results (${filteredNotes.length})`
                  : openFolderId
                    ? `Notes in ${currentFolder?.name} (${filteredNotes.length})`
                    : `Notes (${currentFolderNotes.length})`}
              </h2>
              {filteredNotes.length === 0 ? (
                <div
                  className="text-center py-16 rounded-xl"
                  style={{
                    color: "var(--muted)",
                    background: "var(--card)",
                    border: "1px solid var(--border)",
                  }}
                >
                  <p className="text-sm">
                    {search
                      ? "No matching notes."
                      : openFolderId
                        ? "This folder is empty. Create a note to get started."
                        : 'No notes yet. Click "+ New Note" to create one.'}
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                  {filteredNotes.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      folders={folders}
                      onClick={() => setActiveNoteId(note.id)}
                      onDelete={() => deleteNote(note.id)}
                      onRename={(t) => renameNote(note.id, t)}
                      onMove={(fid) => moveNote(note.id, fid)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function FolderCard({
  folder,
  noteCount,
  onClick,
  onRename,
  onDelete,
}: {
  folder: Folder;
  noteCount: number;
  onClick: () => void;
  onRename: (name: string) => void;
  onDelete: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(folder.name);
  const [showMenu, setShowMenu] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      className="rounded-xl p-4 cursor-pointer transition-colors relative"
      style={{
        background: "var(--card)",
        border: "1px solid var(--border)",
        minHeight: 100,
      }}
      onClick={onClick}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--card-hover)")
      }
      onMouseLeave={(e) =>
        (e.currentTarget.style.background = "var(--card)")
      }
    >
      {/* Folder icon */}
      <div className="text-2xl mb-2" style={{ opacity: 0.7 }}>
        &#128193;
      </div>
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
          className="text-sm font-medium bg-transparent border-none outline-none w-full"
          style={{ color: "var(--foreground)" }}
        />
      ) : (
        <p className="text-sm font-medium truncate">{folder.name}</p>
      )}
      <p className="text-xs mt-1" style={{ color: "var(--muted)" }}>
        {noteCount} {noteCount === 1 ? "note" : "notes"}
      </p>

      {/* Menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          setShowMenu(!showMenu);
        }}
        className="absolute top-2 right-2 text-xs px-2 py-1 rounded cursor-pointer bg-transparent border-none"
        style={{ color: "var(--muted)" }}
      >
        ...
      </button>

      {showMenu && (
        <div
          className="absolute top-8 right-2 rounded-lg shadow-lg py-1 z-20"
          style={{
            background: "var(--card)",
            border: "1px solid var(--border)",
            minWidth: 100,
          }}
          onClick={(e) => e.stopPropagation()}
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
              if (confirm("Delete folder? Notes will move to My Notes."))
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
                    color: !note.folder_id
                      ? "var(--accent)"
                      : "var(--foreground)",
                  }}
                >
                  My Notes (root)
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
                    &#128193; {f.name}
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
            &#128193; {folderName}
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
