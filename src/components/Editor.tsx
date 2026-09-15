"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { getSupabase } from "@/lib/supabase";
import type { Note, Folder } from "@/lib/types";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import "@excalidraw/excalidraw/index.css";

function getStoredTheme(): "dark" | "light" {
  try {
    return (localStorage.getItem("excalidraw-theme") as "dark" | "light") || "dark";
  } catch {
    return "dark";
  }
}

export default function Editor({
  note,
  allNotes,
  folders,
  onBack,
  onRename,
  onSwitchNote,
}: {
  note: Note;
  allNotes: Note[];
  folders: Folder[];
  onBack: () => void;
  onRename: (title: string) => void;
  onSwitchNote: (id: string) => void;
}) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [ExcalidrawComp, setExcalidrawComp] = useState<React.ComponentType<any> | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [MainMenuComp, setMainMenuComp] = useState<any>(null);
  const excalidrawRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [showPanel, setShowPanel] = useState(false);
  const [panelSearch, setPanelSearch] = useState("");
  const initialDataRef = useRef<Record<string, unknown> | null>(null);

  useEffect(() => {
    import("@excalidraw/excalidraw").then((mod) => {
      setExcalidrawComp(() => mod.Excalidraw);
      setMainMenuComp(() => mod.MainMenu);
    });
  }, []);

  useEffect(() => {
    setTitle(note.title);
  }, [note.title]);

  useEffect(() => {
    const theme = getStoredTheme();
    try {
      const parsed =
        typeof note.scene === "string" ? JSON.parse(note.scene) : note.scene;
      if (!parsed.appState) parsed.appState = {};
      parsed.appState.isLoading = false;
      parsed.appState.showWelcomeScreen = false;
      parsed.appState.theme = parsed.appState.theme || theme;
      if (!parsed.elements) parsed.elements = [];
      initialDataRef.current = parsed;
    } catch {
      initialDataRef.current = {
        elements: [],
        appState: { isLoading: false, showWelcomeScreen: false, theme },
      };
    }
  }, [note.scene]);

  const save = useCallback(async () => {
    if (!excalidrawRef.current) return;
    setSaving(true);
    const elements = excalidrawRef.current.getSceneElements();
    const appState = excalidrawRef.current.getAppState();
    const files = excalidrawRef.current.getFiles();

    try {
      localStorage.setItem("excalidraw-theme", appState.theme);
      document.documentElement.setAttribute("data-theme", appState.theme);
    } catch {}

    const scene = JSON.stringify({
      elements,
      appState: {
        viewBackgroundColor: appState.viewBackgroundColor,
        currentItemFontFamily: appState.currentItemFontFamily,
        theme: appState.theme,
      },
      files,
    });

    await getSupabase()
      .from("notes")
      .update({ scene, updated_at: new Date().toISOString() })
      .eq("id", note.id);
    setSaving(false);
  }, [note.id]);

  const debouncedSave = useCallback(() => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(save, 2000);
  }, [save]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      save();
    };
  }, [save]);

  const handleTitleBlur = () => {
    setEditingTitle(false);
    if (title.trim() && title !== note.title) onRename(title.trim());
  };

  const handleSwitch = (id: string) => {
    save();
    setShowPanel(false);
    onSwitchNote(id);
  };

  const filteredNotes = panelSearch
    ? allNotes.filter((n) =>
        n.title.toLowerCase().includes(panelSearch.toLowerCase())
      )
    : allNotes;

  const groupedByFolder = new Map<string | null, Note[]>();
  for (const n of filteredNotes) {
    const key = n.folder_id;
    if (!groupedByFolder.has(key)) groupedByFolder.set(key, []);
    groupedByFolder.get(key)!.push(n);
  }

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 py-2 border-b shrink-0"
        style={{
          borderColor: "var(--border)",
          background: "var(--background)",
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <button
            onClick={() => {
              save();
              onBack();
            }}
            className="text-sm px-2 py-1 rounded cursor-pointer bg-transparent border-none shrink-0"
            style={{ color: "var(--foreground)" }}
          >
            ← Back
          </button>
          <button
            onClick={() => setShowPanel(!showPanel)}
            className="text-sm px-2 py-1 rounded cursor-pointer border-none shrink-0"
            style={{
              background: showPanel ? "var(--accent)" : "var(--card)",
              color: showPanel ? "#fff" : "var(--foreground)",
              border: "1px solid var(--border)",
            }}
            title="Switch notes"
          >
            &#9776;
          </button>
          {editingTitle ? (
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onBlur={handleTitleBlur}
              onKeyDown={(e) => {
                if (e.key === "Enter") (e.target as HTMLInputElement).blur();
              }}
              autoFocus
              className="text-sm font-medium bg-transparent border-none outline-none min-w-0"
              style={{ color: "var(--foreground)" }}
            />
          ) : (
            <span
              className="text-sm font-medium truncate cursor-pointer"
              onClick={() => setEditingTitle(true)}
              title="Click to rename"
            >
              {title}
            </span>
          )}
        </div>
        <span className="text-xs shrink-0" style={{ color: "var(--muted)" }}>
          {saving ? "Saving..." : "Saved"}
        </span>
      </div>

      {/* Main area with optional panel */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>
        {/* Notes panel */}
        {showPanel && (
          <div
            style={{
              width: 260,
              borderRight: "1px solid var(--border)",
              background: "var(--background)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              flexShrink: 0,
            }}
          >
            <div style={{ padding: "8px" }}>
              <input
                type="text"
                placeholder="Search notes..."
                value={panelSearch}
                onChange={(e) => setPanelSearch(e.target.value)}
                className="w-full px-3 py-1.5 rounded text-xs outline-none"
                style={{
                  background: "var(--card)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "0 8px 8px" }}>
              {/* Unfiled notes */}
              {groupedByFolder.get(null)?.map((n) => (
                <button
                  key={n.id}
                  onClick={() => handleSwitch(n.id)}
                  className="w-full text-left px-3 py-2 rounded-lg text-xs cursor-pointer border-none mb-1 truncate"
                  style={{
                    background:
                      n.id === note.id ? "var(--accent)" : "transparent",
                    color: n.id === note.id ? "#fff" : "var(--foreground)",
                  }}
                >
                  {n.title}
                </button>
              ))}
              {/* Folder groups */}
              {folders.map((folder) => {
                const folderNotes = groupedByFolder.get(folder.id);
                if (!folderNotes?.length) return null;
                return (
                  <div key={folder.id} className="mt-2">
                    <p
                      className="text-xs font-semibold px-3 py-1 truncate"
                      style={{ color: "var(--muted)" }}
                    >
                      &#128193; {folder.name}
                    </p>
                    {folderNotes.map((n) => (
                      <button
                        key={n.id}
                        onClick={() => handleSwitch(n.id)}
                        className="w-full text-left px-3 py-2 rounded-lg text-xs cursor-pointer border-none mb-1 truncate"
                        style={{
                          background:
                            n.id === note.id ? "var(--accent)" : "transparent",
                          color:
                            n.id === note.id ? "#fff" : "var(--foreground)",
                          paddingLeft: 20,
                        }}
                      >
                        {n.title}
                      </button>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Excalidraw canvas */}
        <div
          style={{
            flex: 1,
            position: "relative",
            overflow: "hidden",
            width: "100%",
            height: "100%",
          }}
        >
          {ExcalidrawComp && MainMenuComp ? (
            <ExcalidrawComp
              ref={(api: ExcalidrawImperativeAPI) => {
                excalidrawRef.current = api;
              }}
              initialData={initialDataRef.current || undefined}
              onChange={debouncedSave}
              UIOptions={{
                canvasActions: {
                  loadScene: true,
                  export: { saveFileToDisk: true },
                  saveToActiveFile: false,
                },
              }}
            >
              <MainMenuComp>
                <MainMenuComp.DefaultItems.LoadScene />
                <MainMenuComp.DefaultItems.SaveToActiveFile />
                <MainMenuComp.DefaultItems.Export />
                <MainMenuComp.DefaultItems.SaveAsImage />
                <MainMenuComp.DefaultItems.SearchMenu />
                <MainMenuComp.DefaultItems.Help />
                <MainMenuComp.DefaultItems.ClearCanvas />
                <MainMenuComp.DefaultItems.ToggleTheme />
                <MainMenuComp.DefaultItems.ChangeCanvasBackground />
              </MainMenuComp>
            </ExcalidrawComp>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div
                className="animate-spin rounded-full h-8 w-8 border-b-2"
                style={{ borderColor: "var(--accent)" }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
