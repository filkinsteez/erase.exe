"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiFetch } from "@/lib/apiFetch";
import type { DataMode } from "@/lib/config";

type Room = { year: number; postCount: number };

type SummarizedPost = {
  id: string;
  providerPostId: string;
  postedAt: string;
  type: "post" | "reply" | "repost" | "quote";
  text: string;
  likes: number;
  hasMedia: boolean;
  source: "api" | "archive";
};

type ScanFilters = {
  query?: string;
  dateStart?: string;
  dateEnd?: string;
};

type ScanResponse = {
  scanId: string;
  count: number;
  sample: SummarizedPost[];
  truncated: boolean;
  creditsDepleted: boolean;
};

type ByScanResponse = {
  items: SummarizedPost[];
  nextCursor: string | null;
  total: number;
};

type DeleteResponse = {
  deleted: string[];
  failed: Array<{ providerPostId: string; status: number; error: string }>;
  creditsDepleted: boolean;
  rateLimited: boolean;
};

const PAGE_SIZE = 50;
const DELETE_MAX_PER_CALL = 50;

export function Archive({
  handle,
  csrfToken,
  bootstrapError,
  creditsDepleted: initialCreditsDepleted,
  mode,
  archiveUploadEnabled,
  byoKeyEnabled
}: {
  handle: string;
  csrfToken: string;
  bootstrapError: string | null;
  creditsDepleted: boolean;
  mode: DataMode;
  archiveUploadEnabled: boolean;
  byoKeyEnabled: boolean;
}) {
  const [creditsDepleted, setCreditsDepleted] = useState(initialCreditsDepleted);
  const [keyword, setKeyword] = useState("");
  const [dateStart, setDateStart] = useState("");
  const [dateEnd, setDateEnd] = useState("");
  const [appliedFilters, setAppliedFilters] = useState<ScanFilters>({});
  const [rooms, setRooms] = useState<Room[] | null>(null);
  const [roomsError, setRoomsError] = useState<string | null>(bootstrapError);
  const [loadingRooms, setLoadingRooms] = useState(false);

  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [scanId, setScanId] = useState<string | null>(null);
  const [posts, setPosts] = useState<SummarizedPost[]>([]);
  const [postsTotal, setPostsTotal] = useState(0);
  const [postsCursor, setPostsCursor] = useState<string | null>(null);
  const [postsPrevCursors, setPostsPrevCursors] = useState<string[]>([]);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [loadingPosts, setLoadingPosts] = useState(false);

  const [refreshing, setRefreshing] = useState(false);
  const [refreshMessage, setRefreshMessage] = useState<string | null>(null);
  const [severing, setSevering] = useState(false);

  const [archiveFile, setArchiveFile] = useState<File | null>(null);
  const [archiveUploading, setArchiveUploading] = useState(false);
  const [archiveMessage, setArchiveMessage] = useState<string | null>(null);

  const [byoBearer, setByoBearer] = useState("");
  const [byoSaving, setByoSaving] = useState(false);
  const [byoMessage, setByoMessage] = useState<string | null>(null);
  const [byoConfigured, setByoConfigured] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTyped, setConfirmTyped] = useState("");

  const [yearsCursor, setYearsCursor] = useState(0);
  const [postsRowCursor, setPostsRowCursor] = useState(0);
  const [viewingPost, setViewingPost] = useState<SummarizedPost | null>(null);

  const loadRooms = useCallback(
    async (filters: ScanFilters) => {
      setLoadingRooms(true);
      setRoomsError(null);
      try {
        const search = new URLSearchParams();
        if (filters.query) search.set("query", filters.query);
        if (filters.dateStart) search.set("dateStart", filters.dateStart);
        if (filters.dateEnd) search.set("dateEnd", filters.dateEnd);
        const qs = search.toString();
        const data = await apiFetch<{ rooms: Room[] }>(
          `/api/posts/rooms${qs ? `?${qs}` : ""}`
        );
        setRooms(data.rooms);
      } catch (error) {
        setRoomsError(error instanceof Error ? error.message : "Failed to load years.");
      } finally {
        setLoadingRooms(false);
      }
    },
    []
  );

  useEffect(() => {
    void loadRooms({});
  }, [loadRooms]);

  const applyFilters = () => {
    const next: ScanFilters = {};
    const k = keyword.trim();
    if (k) next.query = k;
    if (isValidDate(dateStart)) next.dateStart = dateStart;
    if (isValidDate(dateEnd)) next.dateEnd = dateEnd;
    setAppliedFilters(next);
    setSelectedYear(null);
    setScanId(null);
    setPosts([]);
    setPostsTotal(0);
    setPostsCursor(null);
    setPostsPrevCursors([]);
    void loadRooms(next);
  };

  const clearFilters = () => {
    setKeyword("");
    setDateStart("");
    setDateEnd("");
    setAppliedFilters({});
    setSelectedYear(null);
    setScanId(null);
    setPosts([]);
    setPostsTotal(0);
    setPostsCursor(null);
    setPostsPrevCursors([]);
    void loadRooms({});
  };

  const openYear = async (year: number) => {
    setSelectedYear(year);
    setLoadingPosts(true);
    setPostsError(null);
    setPosts([]);
    setPostsCursor(null);
    setPostsPrevCursors([]);
    try {
      const filters: ScanFilters = {
        ...appliedFilters,
        dateStart: `${year}-01-01`,
        dateEnd: `${year}-12-31`
      };
      const scan = await apiFetch<ScanResponse>("/api/posts/scan", {
        method: "POST",
        csrfToken,
        body: JSON.stringify({
          source: "api",
          sort: "reverse_chronological",
          filters
        })
      });
      setScanId(scan.scanId);
      await loadPostsPage(scan.scanId, null, []);
    } catch (error) {
      setPostsError(error instanceof Error ? error.message : "Scan failed.");
      setLoadingPosts(false);
    }
  };

  const loadPostsPage = async (
    targetScanId: string,
    cursor: string | null,
    prev: string[]
  ) => {
    setLoadingPosts(true);
    setPostsError(null);
    setSelectedIds(new Set());
    try {
      const params = new URLSearchParams({ scanId: targetScanId, limit: String(PAGE_SIZE) });
      if (cursor) params.set("cursor", cursor);
      const data = await apiFetch<ByScanResponse>(`/api/posts/by-scan?${params.toString()}`);
      setPosts(data.items);
      setPostsTotal(data.total);
      setPostsCursor(data.nextCursor);
      setPostsPrevCursors(prev);
    } catch (error) {
      setPostsError(error instanceof Error ? error.message : "Failed to load posts.");
    } finally {
      setLoadingPosts(false);
    }
  };

  const closeYear = () => {
    setSelectedYear(null);
    setScanId(null);
    setPosts([]);
    setPostsTotal(0);
    setPostsCursor(null);
    setPostsPrevCursors([]);
    setSelectedIds(new Set());
    setDeleteMessage(null);
  };

  const nextPostsPage = () => {
    if (!scanId || !postsCursor) return;
    void loadPostsPage(scanId, postsCursor, [...postsPrevCursors, postsCursor]);
  };

  const prevPostsPage = () => {
    if (!scanId) return;
    const next = [...postsPrevCursors];
    next.pop();
    const cursor = next.length > 0 ? next[next.length - 1] : null;
    void loadPostsPage(scanId, cursor, next.slice(0, -1));
  };

  const refresh = async () => {
    setRefreshing(true);
    setRefreshMessage(null);
    try {
      const scan = await apiFetch<ScanResponse>("/api/posts/scan", {
        method: "POST",
        csrfToken,
        body: JSON.stringify({
          source: "api",
          sort: "reverse_chronological",
          filters: {},
          refresh: true
        })
      });
      setCreditsDepleted(scan.creditsDepleted);
      if (scan.creditsDepleted && scan.count === 0) {
        setRefreshMessage("REFRESH FAILED: X API CREDITS DEPLETED.");
      } else {
        setRefreshMessage(
          `REFRESHED. ${scan.count.toLocaleString()} POSTS INDEXED${scan.truncated ? " (TRUNCATED)" : ""}${scan.creditsDepleted ? " (CREDITS DEPLETED MID-FETCH)" : ""}.`
        );
      }
      await loadRooms(appliedFilters);
      if (scanId && selectedYear !== null) {
        const cursor = postsPrevCursors.length > 0 ? postsPrevCursors[postsPrevCursors.length - 1] : null;
        await loadPostsPage(scanId, cursor, postsPrevCursors);
      }
    } catch (error) {
      setRefreshMessage(
        `REFRESH FAILED: ${error instanceof Error ? error.message : "unknown error"}`
      );
    } finally {
      setRefreshing(false);
    }
  };

  const sever = async () => {
    if (severing) return;
    const ok = window.confirm(
      "Sever link? Encrypted tokens and indexed posts for this account will be deleted. Already-deleted posts on X are not affected."
    );
    if (!ok) return;
    setSevering(true);
    try {
      const response = await fetch("/api/x/oauth/revoke", {
        method: "POST",
        headers: { "x-tweet-delete-csrf": csrfToken }
      });
      if (!response.ok) throw new Error(`Sever failed (${response.status}).`);
      window.location.href = "/?severed=1";
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Sever failed.");
      setSevering(false);
    }
  };

  const handleEnterKeyApply = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      applyFilters();
    }
  };

  const uploadArchive = async () => {
    if (!archiveFile || archiveUploading) return;
    setArchiveUploading(true);
    setArchiveMessage(null);
    try {
      const form = new FormData();
      form.append("file", archiveFile);
      const response = await fetch("/api/archive/upload", {
        method: "POST",
        headers: { "x-tweet-delete-csrf": csrfToken },
        body: form
      });
      const data = (await response.json().catch(() => null)) as
        | { imported?: number; parsed?: number; error?: string }
        | null;
      if (!response.ok) {
        throw new Error(data?.error || `Upload failed (${response.status}).`);
      }
      setArchiveMessage(
        `ARCHIVE IMPORTED. ${(data?.imported ?? 0).toLocaleString()} POSTS WRITTEN (${(data?.parsed ?? 0).toLocaleString()} PARSED).`
      );
      setArchiveFile(null);
      await loadRooms(appliedFilters);
      if (selectedYear !== null && scanId) {
        const cursor =
          postsPrevCursors.length > 0 ? postsPrevCursors[postsPrevCursors.length - 1] : null;
        await loadPostsPage(scanId, cursor, postsPrevCursors);
      }
    } catch (error) {
      setArchiveMessage(
        `ARCHIVE UPLOAD FAILED: ${error instanceof Error ? error.message : "unknown error"}`
      );
    } finally {
      setArchiveUploading(false);
    }
  };

  const saveByoKey = async () => {
    if (byoSaving) return;
    const trimmed = byoBearer.trim();
    if (!trimmed) {
      setByoMessage("PASTE AN APP-ONLY BEARER TOKEN FIRST.");
      return;
    }
    setByoSaving(true);
    setByoMessage(null);
    try {
      const response = await fetch("/api/account/byo-key", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "x-tweet-delete-csrf": csrfToken
        },
        body: JSON.stringify({ bearer: trimmed })
      });
      if (!response.ok) {
        const data = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error || `Save failed (${response.status}).`);
      }
      setByoBearer("");
      setByoConfigured(true);
      setByoMessage("API KEY SAVED. CLICK [ REFRESH FROM X ] TO RE-RUN INITIAL FETCH.");
    } catch (error) {
      setByoMessage(
        `BYO KEY SAVE FAILED: ${error instanceof Error ? error.message : "unknown error"}`
      );
    } finally {
      setByoSaving(false);
    }
  };

  const togglePostSelected = (providerPostId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(providerPostId)) next.delete(providerPostId);
      else next.add(providerPostId);
      return next;
    });
  };

  const togglePageSelected = () => {
    setSelectedIds((prev) => {
      const pageIds = posts.map((p) => p.providerPostId);
      const allSelected = pageIds.length > 0 && pageIds.every((id) => prev.has(id));
      if (allSelected) {
        const next = new Set(prev);
        for (const id of pageIds) next.delete(id);
        return next;
      }
      const next = new Set(prev);
      for (const id of pageIds) next.add(id);
      return next;
    });
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
    setDeleteMessage(null);
  };

  const cleanHandle = handle.replace(/^@/, "");
  const pendingDeleteCount = Math.min(selectedIds.size, DELETE_MAX_PER_CALL);
  const confirmVerse = [
    "I walked the archive.",
    "I opened the boxes.",
    "Who will love me when the old words are gone.",
    `Delete ${pendingDeleteCount} posts from @${cleanHandle}.`
  ].join("\n");

  const openDeleteConfirm = () => {
    if (deleting || selectedIds.size === 0) return;
    setConfirmTyped("");
    setConfirmOpen(true);
  };

  const cancelDeleteConfirm = () => {
    if (deleting) return;
    setConfirmOpen(false);
    setConfirmTyped("");
  };

  const confirmAndDelete = async () => {
    if (deleting) return;
    const ids = Array.from(selectedIds).slice(0, DELETE_MAX_PER_CALL);
    if (ids.length === 0) return;
    if (!verseMatches(confirmTyped, confirmVerse)) return;
    setConfirmOpen(false);
    setConfirmTyped("");
    setDeleting(true);
    setDeleteMessage(null);
    try {
      const response = await fetch("/api/posts/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tweet-delete-csrf": csrfToken
        },
        body: JSON.stringify({ postIds: ids })
      });
      const data = (await response.json().catch(() => null)) as
        | (DeleteResponse & { error?: string })
        | null;
      if (!response.ok) {
        throw new Error(data?.error || `Delete failed (${response.status}).`);
      }
      const deleted = data?.deleted ?? [];
      const failed = data?.failed ?? [];
      setCreditsDepleted(Boolean(data?.creditsDepleted) || creditsDepleted);
      const parts: string[] = [
        `DELETED ${deleted.length.toLocaleString()} OF ${ids.length.toLocaleString()}.`
      ];
      if (data?.creditsDepleted) parts.push("X API CREDITS DEPLETED MID-RUN.");
      if (data?.rateLimited) parts.push("X API RATE LIMIT HIT. TRY AGAIN IN 15 MIN.");
      if (failed.length > 0 && !data?.creditsDepleted && !data?.rateLimited) {
        parts.push(`${failed.length.toLocaleString()} FAILED.`);
      }
      setDeleteMessage(parts.join(" "));
      setSelectedIds((prev) => {
        const next = new Set(prev);
        for (const id of deleted) next.delete(id);
        return next;
      });
      await loadRooms(appliedFilters);
      if (scanId && selectedYear !== null) {
        const cursor =
          postsPrevCursors.length > 0 ? postsPrevCursors[postsPrevCursors.length - 1] : null;
        await loadPostsPage(scanId, cursor, postsPrevCursors);
      }
    } catch (error) {
      setDeleteMessage(
        `DELETE FAILED: ${error instanceof Error ? error.message : "unknown error"}`
      );
    } finally {
      setDeleting(false);
    }
  };

  const clearByoKey = async () => {
    if (byoSaving) return;
    if (!window.confirm("Clear your saved BYO API key?")) return;
    setByoSaving(true);
    setByoMessage(null);
    try {
      const response = await fetch("/api/account/byo-key", {
        method: "DELETE",
        headers: { "x-tweet-delete-csrf": csrfToken }
      });
      if (!response.ok) throw new Error(`Clear failed (${response.status}).`);
      setByoConfigured(false);
      setByoMessage("API KEY CLEARED.");
    } catch (error) {
      setByoMessage(
        `BYO KEY CLEAR FAILED: ${error instanceof Error ? error.message : "unknown error"}`
      );
    } finally {
      setByoSaving(false);
    }
  };

  useEffect(() => {
    setYearsCursor((idx) => {
      if (!rooms || rooms.length === 0) return 0;
      return Math.min(idx, rooms.length - 1);
    });
  }, [rooms]);

  useEffect(() => {
    setPostsRowCursor((idx) => {
      if (posts.length === 0) return 0;
      return Math.min(idx, posts.length - 1);
    });
  }, [posts]);

  const cleanHandleRef = useRef(handle.replace(/^@/, ""));
  useEffect(() => {
    cleanHandleRef.current = handle.replace(/^@/, "");
  }, [handle]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (confirmOpen) return;
      if (viewingPost) return;
      const target = event.target as HTMLElement | null;
      const tag = target?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (target?.isContentEditable) return;

      if (selectedYear === null) {
        const list = rooms ?? [];
        if (list.length === 0) return;
        if (event.key === "ArrowDown" || event.key === "j") {
          event.preventDefault();
          setYearsCursor((i) => Math.min(list.length - 1, i + 1));
        } else if (event.key === "ArrowUp" || event.key === "k") {
          event.preventDefault();
          setYearsCursor((i) => Math.max(0, i - 1));
        } else if (event.key === "Home") {
          event.preventDefault();
          setYearsCursor(0);
        } else if (event.key === "End") {
          event.preventDefault();
          setYearsCursor(list.length - 1);
        } else if (event.key === "Enter" || event.key === "ArrowRight") {
          event.preventDefault();
          const room = list[Math.min(yearsCursor, list.length - 1)];
          if (room) void openYear(room.year);
        }
        return;
      }

      if (event.key === "Escape" || event.key === "Backspace") {
        event.preventDefault();
        closeYear();
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "h") {
        if (postsPrevCursors.length > 0 && !loadingPosts) {
          event.preventDefault();
          prevPostsPage();
        }
        return;
      }
      if (event.key === "ArrowRight" || event.key === "l") {
        if (postsCursor !== null && !loadingPosts) {
          event.preventDefault();
          nextPostsPage();
        }
        return;
      }
      if (posts.length === 0) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        setPostsRowCursor((i) => Math.min(posts.length - 1, i + 1));
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        setPostsRowCursor((i) => Math.max(0, i - 1));
      } else if (event.key === "Home") {
        event.preventDefault();
        setPostsRowCursor(0);
      } else if (event.key === "End") {
        event.preventDefault();
        setPostsRowCursor(posts.length - 1);
      } else if (event.key === " " || event.key === "x") {
        event.preventDefault();
        const p = posts[Math.min(postsRowCursor, posts.length - 1)];
        if (p) togglePostSelected(p.providerPostId);
      } else if (event.key === "Enter") {
        event.preventDefault();
        const p = posts[Math.min(postsRowCursor, posts.length - 1)];
        if (p) setViewingPost(p);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [
    confirmOpen,
    viewingPost,
    selectedYear,
    rooms,
    yearsCursor,
    posts,
    postsRowCursor,
    postsCursor,
    postsPrevCursors,
    loadingPosts
  ]);

  useEffect(() => {
    if (!byoKeyEnabled) return;
    let alive = true;
    fetch("/api/account/byo-key", { method: "GET" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { configured?: boolean } | null) => {
        if (alive && data && typeof data.configured === "boolean") {
          setByoConfigured(data.configured);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [byoKeyEnabled]);

  const totalPosts = useMemo(
    () => (rooms ?? []).reduce((sum, r) => sum + r.postCount, 0),
    [rooms]
  );
  const maxRoom = useMemo(
    () => (rooms ?? []).reduce((max, r) => Math.max(max, r.postCount), 0),
    [rooms]
  );
  const filtersActive =
    Boolean(appliedFilters.query) ||
    Boolean(appliedFilters.dateStart) ||
    Boolean(appliedFilters.dateEnd);

  return (
    <main className="dos-main">
      <div className="dos-panel">
        <header className="dos-panel-head">
          <span className="dos-brand">TWEET-DELETE</span>
          <span className="dos-dim">
            {handle ? `@${handle.replace(/^@/, "")}` : "CONNECTED"}
            {" "}&middot;{" "}
            {totalPosts.toLocaleString()} INDEXED
          </span>
          <span className="dos-row">
            <button
              type="button"
              className="dos-button"
              onClick={refresh}
              disabled={refreshing}
            >
              {refreshing ? "[ Refreshing... ]" : "[ Refresh from X ]"}
            </button>
            <button
              type="button"
              className="dos-button dos-button-danger"
              onClick={sever}
              disabled={severing}
            >
              {severing ? "[ Severing... ]" : "[ Sever link ]"}
            </button>
          </span>
        </header>

        <div className="dos-panel-body dos-stack">
          {refreshMessage ? <p className="dos-ok">{refreshMessage}</p> : null}
          {creditsDepleted ? (
            <p className="dos-error">
              SERVER API CREDITS DEPLETED. SERVICE TEMPORARILY UNAVAILABLE.
              {archiveUploadEnabled || byoKeyEnabled
                ? " LOAD YOUR DATA VIA ARCHIVE UPLOAD OR API KEY BELOW."
                : null}
            </p>
          ) : bootstrapError ? (
            <p className="dos-error">
              INITIAL FETCH FAILED: {bootstrapError}
            </p>
          ) : null}

          <section className="dos-fieldset">
            <div className="dos-fieldset-label">FILTERS</div>
            <div className="dos-filter-grid">
              <label className="dos-field">
                <span>KEYWORD</span>
                <input
                  type="text"
                  value={keyword}
                  onChange={(e) => setKeyword(e.target.value)}
                  onKeyDown={handleEnterKeyApply}
                  placeholder="any substring"
                  maxLength={200}
                  spellCheck={false}
                />
              </label>
              <label className="dos-field">
                <span>FROM</span>
                <input
                  type="date"
                  value={dateStart}
                  onChange={(e) => setDateStart(e.target.value)}
                  onKeyDown={handleEnterKeyApply}
                />
              </label>
              <label className="dos-field">
                <span>TO</span>
                <input
                  type="date"
                  value={dateEnd}
                  onChange={(e) => setDateEnd(e.target.value)}
                  onKeyDown={handleEnterKeyApply}
                />
              </label>
              <div className="dos-row">
                <button type="button" className="dos-button" onClick={applyFilters}>
                  [ Apply ]
                </button>
                <button
                  type="button"
                  className="dos-button"
                  onClick={clearFilters}
                  disabled={!filtersActive && !keyword && !dateStart && !dateEnd}
                >
                  [ Clear ]
                </button>
              </div>
            </div>
          </section>

          {archiveUploadEnabled ? (
            <section className="dos-fieldset">
              <div className="dos-fieldset-label">LOAD FROM ARCHIVE</div>
              <p className="dos-dim" style={{ margin: "0.25rem 0" }}>
                Request your X data archive at x.com &rarr; Settings &rarr; Your account
                &rarr; Download an archive of your data. Upload the resulting .zip here.
                Parses data/tweets.js and inserts posts with source=archive.
              </p>
              <div className="dos-row">
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(e) => setArchiveFile(e.target.files?.[0] ?? null)}
                  disabled={archiveUploading}
                />
                <button
                  type="button"
                  className="dos-button"
                  onClick={uploadArchive}
                  disabled={!archiveFile || archiveUploading}
                >
                  {archiveUploading ? "[ Uploading... ]" : "[ Upload ]"}
                </button>
              </div>
              {archiveMessage ? (
                <p
                  className={
                    archiveMessage.startsWith("ARCHIVE IMPORTED") ? "dos-ok" : "dos-error"
                  }
                  style={{ margin: "0.5rem 0 0" }}
                >
                  {archiveMessage}
                </p>
              ) : null}
            </section>
          ) : null}

          {byoKeyEnabled ? (
            <section className="dos-fieldset">
              <div className="dos-fieldset-label">BRING YOUR OWN X API KEY</div>
              <p className="dos-dim" style={{ margin: "0.25rem 0" }}>
                Paste an app-only Bearer Token from your own X developer app. Your token
                will be encrypted and used instead of the server&apos;s credentials for
                your timeline reads. Only works if your X account is public.
                {byoConfigured ? " (A KEY IS CURRENTLY SAVED.)" : ""}
              </p>
              <div className="dos-row">
                <input
                  type="password"
                  value={byoBearer}
                  onChange={(e) => setByoBearer(e.target.value)}
                  placeholder="AAAAAAAA...bearer token"
                  autoComplete="off"
                  spellCheck={false}
                  style={{ minWidth: 0, flex: "1 1 24ch" }}
                />
                <button
                  type="button"
                  className="dos-button"
                  onClick={saveByoKey}
                  disabled={byoSaving || !byoBearer.trim()}
                >
                  {byoSaving ? "[ Saving... ]" : "[ Save key ]"}
                </button>
                {byoConfigured ? (
                  <button
                    type="button"
                    className="dos-button dos-button-danger"
                    onClick={clearByoKey}
                    disabled={byoSaving}
                  >
                    [ Clear key ]
                  </button>
                ) : null}
              </div>
              {byoMessage ? (
                <p
                  className={
                    byoMessage.includes("FAILED") || byoMessage.startsWith("PASTE")
                      ? "dos-error"
                      : "dos-ok"
                  }
                  style={{ margin: "0.5rem 0 0" }}
                >
                  {byoMessage}
                </p>
              ) : null}
            </section>
          ) : null}

          {mode === "user" && !archiveUploadEnabled && !byoKeyEnabled ? (
            <p className="dos-dim">
              This environment is set to user-supplied data mode, but no input method is
              enabled. Set TWEET_DELETE_ARCHIVE_UPLOAD_ENABLED or TWEET_DELETE_BYO_KEY_ENABLED.
            </p>
          ) : null}

          {selectedYear === null ? (
            <YearsTable
              rooms={rooms}
              loading={loadingRooms}
              error={roomsError}
              filtersActive={filtersActive}
              total={totalPosts}
              maxRoom={maxRoom}
              onOpen={openYear}
              cursor={yearsCursor}
              onCursorChange={setYearsCursor}
            />
          ) : (
            <PostsTable
              handle={handle}
              year={selectedYear}
              posts={posts}
              total={postsTotal}
              loading={loadingPosts}
              error={postsError}
              hasPrev={postsPrevCursors.length > 0}
              hasNext={postsCursor !== null}
              onClose={closeYear}
              onPrev={prevPostsPage}
              onNext={nextPostsPage}
              selectedIds={selectedIds}
              onToggleSelected={togglePostSelected}
              onTogglePageSelected={togglePageSelected}
              onClearSelection={clearSelection}
              onDeleteSelected={openDeleteConfirm}
              deleting={deleting}
              deleteMessage={deleteMessage}
              creditsDepleted={creditsDepleted}
              cursor={postsRowCursor}
              onCursorChange={setPostsRowCursor}
              onView={setViewingPost}
            />
          )}
        </div>
      </div>
      {viewingPost ? (
        <PostViewerModal
          handle={cleanHandle}
          post={viewingPost}
          onClose={() => setViewingPost(null)}
        />
      ) : null}
      {confirmOpen ? (
        <ConfirmDeleteModal
          count={pendingDeleteCount}
          handle={cleanHandle}
          verse={confirmVerse}
          typed={confirmTyped}
          onTypedChange={setConfirmTyped}
          onCancel={cancelDeleteConfirm}
          onConfirm={() => void confirmAndDelete()}
          submitting={deleting}
        />
      ) : null}
    </main>
  );
}

function YearsTable({
  rooms,
  loading,
  error,
  filtersActive,
  total,
  maxRoom,
  onOpen,
  cursor,
  onCursorChange
}: {
  rooms: Room[] | null;
  loading: boolean;
  error: string | null;
  filtersActive: boolean;
  total: number;
  maxRoom: number;
  onOpen: (year: number) => void;
  cursor: number;
  onCursorChange: (index: number) => void;
}) {
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);
  const safeCursor = rooms && rooms.length > 0 ? Math.min(cursor, rooms.length - 1) : -1;

  useEffect(() => {
    if (safeCursor < 0) return;
    const row = rowRefs.current[safeCursor];
    row?.scrollIntoView({ block: "nearest" });
  }, [safeCursor]);

  return (
    <section className="dos-fieldset">
      <div className="dos-fieldset-label dos-row-between">
        <span>YEARS {filtersActive ? "(FILTERED)" : ""}</span>
        {rooms && rooms.length > 0 ? (
          <span className="dos-dim" style={{ letterSpacing: "0.04em" }}>
            [ UP/DOWN ] SELECT &middot; [ ENTER ] OPEN
          </span>
        ) : null}
      </div>

      {error ? <p className="dos-error">{error}</p> : null}
      {loading ? <p className="dos-dim">LOADING...</p> : null}
      {!loading && !error && rooms && rooms.length === 0 ? (
        <p className="dos-dim">
          {filtersActive
            ? "NO POSTS MATCH THE CURRENT FILTERS."
            : "NO POSTS INDEXED. CLICK [ REFRESH FROM X ] ABOVE."}
        </p>
      ) : null}

      {rooms && rooms.length > 0 ? (
        <table className="dos-table">
          <thead>
            <tr>
              <th className="col-year">YEAR</th>
              <th className="col-count">POSTS</th>
              <th className="col-bar">DISTRIBUTION</th>
              <th className="col-action">&nbsp;</th>
            </tr>
          </thead>
          <tbody>
            {rooms.map((room, index) => {
              const isCursor = index === safeCursor;
              return (
                <tr
                  key={room.year}
                  ref={(el) => {
                    rowRefs.current[index] = el;
                  }}
                  className={
                    isCursor ? "dos-row-clickable dos-row-cursor" : "dos-row-clickable"
                  }
                  onClick={() => onOpen(room.year)}
                  onMouseEnter={() => onCursorChange(index)}
                >
                  <td className="col-year">{room.year}</td>
                  <td className="col-count">{room.postCount.toLocaleString()}</td>
                  <td className="col-bar">
                    <TextBar value={room.postCount} max={maxRoom} />
                  </td>
                  <td className="col-action">[ OPEN ]</td>
                </tr>
              );
            })}
            <tr className="dos-row-total">
              <td className="col-year">TOTAL</td>
              <td className="col-count">{total.toLocaleString()}</td>
              <td className="col-bar" colSpan={2}>&nbsp;</td>
            </tr>
          </tbody>
        </table>
      ) : null}
    </section>
  );
}

function PostsTable({
  handle,
  year,
  posts,
  total,
  loading,
  error,
  hasPrev,
  hasNext,
  onClose,
  onPrev,
  onNext,
  selectedIds,
  onToggleSelected,
  onTogglePageSelected,
  onClearSelection,
  onDeleteSelected,
  onView,
  deleting,
  deleteMessage,
  creditsDepleted,
  cursor,
  onCursorChange
}: {
  handle: string;
  year: number;
  posts: SummarizedPost[];
  total: number;
  loading: boolean;
  error: string | null;
  hasPrev: boolean;
  hasNext: boolean;
  onClose: () => void;
  onPrev: () => void;
  onNext: () => void;
  selectedIds: Set<string>;
  onToggleSelected: (providerPostId: string) => void;
  onTogglePageSelected: () => void;
  onClearSelection: () => void;
  onDeleteSelected: () => void;
  onView: (post: SummarizedPost) => void;
  deleting: boolean;
  deleteMessage: string | null;
  creditsDepleted: boolean;
  cursor: number;
  onCursorChange: (index: number) => void;
}) {
  const cleanHandle = handle.replace(/^@/, "");
  const pageIds = posts.map((p) => p.providerPostId);
  const pageAllSelected =
    pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;
  const safeCursor = posts.length > 0 ? Math.min(cursor, posts.length - 1) : -1;
  const rowRefs = useRef<Array<HTMLTableRowElement | null>>([]);

  useEffect(() => {
    if (safeCursor < 0) return;
    const row = rowRefs.current[safeCursor];
    row?.scrollIntoView({ block: "nearest" });
  }, [safeCursor]);
  return (
    <section className="dos-fieldset">
      <div className="dos-fieldset-label dos-row-between">
        <span>
          {year} &middot; {total.toLocaleString()} POST{total === 1 ? "" : "S"}
        </span>
        <button type="button" className="dos-button" onClick={onClose}>
          [ Back to years ]
        </button>
      </div>
      {posts.length > 0 ? (
        <p className="dos-dim" style={{ margin: "0.25rem 0 0", letterSpacing: "0.04em" }}>
          [ UP/DOWN ] ROW &middot; [ SPACE ] SELECT &middot; [ LEFT/RIGHT ] PAGE &middot; [ ENTER ] VIEW &middot; [ ESC ] BACK
        </p>
      ) : null}

      {error ? <p className="dos-error">{error}</p> : null}
      {loading ? <p className="dos-dim">LOADING...</p> : null}

      {!loading && posts.length === 0 && !error ? (
        <p className="dos-dim">NO POSTS IN THIS YEAR MATCH THE CURRENT FILTERS.</p>
      ) : null}

      {posts.length > 0 ? (
        <>
          <div className="dos-row-between" style={{ margin: "0.25rem 0 0.5rem" }}>
            <span className="dos-dim">
              {selectedCount > 0
                ? `${selectedCount.toLocaleString()} SELECTED (MAX ${DELETE_MAX_PER_CALL} PER BATCH)`
                : "SELECT POSTS TO DELETE"}
            </span>
            <span className="dos-row">
              <button
                type="button"
                className="dos-button"
                onClick={onClearSelection}
                disabled={deleting || selectedCount === 0}
              >
                [ Clear selection ]
              </button>
              <button
                type="button"
                className="dos-button dos-button-danger"
                onClick={onDeleteSelected}
                disabled={deleting || selectedCount === 0 || creditsDepleted}
                title={
                  creditsDepleted
                    ? "X API credits depleted; cannot delete right now."
                    : undefined
                }
              >
                {deleting
                  ? "[ Deleting... ]"
                  : `[ Delete ${Math.min(selectedCount, DELETE_MAX_PER_CALL)} from X ]`}
              </button>
            </span>
          </div>
          {deleteMessage ? (
            <p
              className={
                deleteMessage.startsWith("DELETED") && !deleteMessage.includes("FAILED")
                  ? "dos-ok"
                  : "dos-error"
              }
              style={{ margin: "0 0 0.5rem" }}
            >
              {deleteMessage}
            </p>
          ) : null}
          <table className="dos-table">
            <thead>
              <tr>
                <th className="col-select">
                  <input
                    type="checkbox"
                    aria-label="Select all on page"
                    checked={pageAllSelected}
                    onChange={onTogglePageSelected}
                    disabled={deleting}
                  />
                </th>
                <th className="col-date">DATE</th>
                <th className="col-type">TYPE</th>
                <th className="col-text">TEXT</th>
                <th className="col-likes">LIKES</th>
                <th className="col-link">&nbsp;</th>
              </tr>
            </thead>
            <tbody>
              {posts.map((post, index) => {
                const checked = selectedIds.has(post.providerPostId);
                const isCursor = index === safeCursor;
                const classes = [
                  checked ? "dos-row-selected" : "",
                  isCursor ? "dos-row-cursor" : ""
                ]
                  .filter(Boolean)
                  .join(" ");
                return (
                  <tr
                    key={post.id}
                    ref={(el) => {
                      rowRefs.current[index] = el;
                    }}
                    className={classes || undefined}
                    onMouseEnter={() => onCursorChange(index)}
                  >
                    <td className="col-select">
                      <input
                        type="checkbox"
                        aria-label={`Select post ${post.providerPostId}`}
                        checked={checked}
                        onChange={() => onToggleSelected(post.providerPostId)}
                        disabled={deleting}
                      />
                    </td>
                    <td className="col-date">{formatDate(post.postedAt)}</td>
                    <td className="col-type">{post.type.toUpperCase()}</td>
                    <td className="col-text">
                      {post.text}
                      {post.hasMedia ? <span className="dos-dim"> [MEDIA]</span> : null}
                    </td>
                    <td className="col-likes">{post.likes.toLocaleString()}</td>
                    <td className="col-link">
                      <button
                        type="button"
                        className="dos-link dos-link-button"
                        onClick={() => onView(post)}
                      >
                        [ View ]
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {(hasPrev || hasNext) && (
            <div className="dos-row-between">
              <button
                type="button"
                className="dos-button"
                onClick={onPrev}
                disabled={!hasPrev}
              >
                [ &lt; Newer ]
              </button>
              <button
                type="button"
                className="dos-button"
                onClick={onNext}
                disabled={!hasNext}
              >
                [ Older &gt; ]
              </button>
            </div>
          )}
        </>
      ) : null}
    </section>
  );
}

function verseMatches(typed: string, expected: string): boolean {
  const normalize = (value: string) =>
    value
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0)
      .join("\n")
      .toLowerCase();
  return normalize(typed) === normalize(expected);
}

function ConfirmDeleteModal({
  count,
  handle,
  verse,
  typed,
  onTypedChange,
  onCancel,
  onConfirm,
  submitting
}: {
  count: number;
  handle: string;
  verse: string;
  typed: string;
  onTypedChange: (value: string) => void;
  onCancel: () => void;
  onConfirm: () => void;
  submitting: boolean;
}) {
  const matches = verseMatches(typed, verse);
  const handleKeyDown: React.KeyboardEventHandler<HTMLTextAreaElement> = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onCancel();
    } else if (
      event.key === "Enter" &&
      (event.ctrlKey || event.metaKey) &&
      matches &&
      !submitting
    ) {
      event.preventDefault();
      onConfirm();
    }
  };
  return (
    <div
      className="dos-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dos-modal-title"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onCancel();
      }}
    >
      <div className="dos-modal dos-panel">
        <header className="dos-panel-head">
          <span className="dos-brand" id="dos-modal-title">
            DELETION VERSE
          </span>
          <span className="dos-dim">DESTRUCTIVE</span>
        </header>
        <div className="dos-panel-body dos-stack">
          <p>
            You are about to permanently delete {count.toLocaleString()} post
            {count === 1 ? "" : "s"} from @{handle}.
          </p>
          <p className="dos-dim">
            Deletion happens on X itself via your account. Already-deleted posts are
            skipped. This cannot be undone.
          </p>
          <p>TYPE THE VERSE BELOW, EXACTLY, TO CONFIRM:</p>
          <pre className="dos-literal" aria-label="Required confirmation verse">
            {verse}
          </pre>
          <label className="dos-field">
            <span className="dos-dim">YOUR INPUT</span>
            <textarea
              value={typed}
              onChange={(e) => onTypedChange(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              disabled={submitting}
              rows={verse.split("\n").length + 1}
              placeholder={verse}
              className="dos-verse-input"
            />
          </label>
          <div className="dos-row-between">
            <button
              type="button"
              className="dos-button"
              onClick={onCancel}
              disabled={submitting}
            >
              [ Cancel ]
            </button>
            <button
              type="button"
              className="dos-button dos-button-danger"
              onClick={onConfirm}
              disabled={!matches || submitting}
            >
              {submitting ? "[ Deleting... ]" : "[ Confirm delete ]"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PostViewerModal({
  handle,
  post,
  onClose
}: {
  handle: string;
  post: SummarizedPost;
  onClose: () => void;
}) {
  const url = `https://x.com/${handle}/status/${post.providerPostId}`;
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
      } else if (event.key === "Enter") {
        const target = event.target as HTMLElement | null;
        const tag = target?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea") return;
        event.preventDefault();
        window.open(url, "_blank", "noreferrer");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [url, onClose]);

  return (
    <div
      className="dos-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="dos-post-title"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="dos-modal dos-panel">
        <header className="dos-panel-head">
          <span className="dos-brand" id="dos-post-title">
            POST &middot; @{handle}
          </span>
          <span className="dos-dim">
            {post.source === "archive" ? "ARCHIVE" : "X API"}
          </span>
        </header>
        <div className="dos-panel-body dos-stack">
          <dl className="dos-kv">
            <div className="dos-kv-row">
              <dt>DATE</dt>
              <dd>{formatDate(post.postedAt)}</dd>
            </div>
            <div className="dos-kv-row">
              <dt>TYPE</dt>
              <dd>{post.type.toUpperCase()}</dd>
            </div>
            <div className="dos-kv-row">
              <dt>LIKES</dt>
              <dd>{post.likes.toLocaleString()}</dd>
            </div>
            <div className="dos-kv-row">
              <dt>ID</dt>
              <dd>{post.providerPostId}</dd>
            </div>
            {post.hasMedia ? (
              <div className="dos-kv-row">
                <dt>MEDIA</dt>
                <dd className="dos-dim">
                  Attached media is not rendered here. Open on X to view.
                </dd>
              </div>
            ) : null}
          </dl>
          <div>
            <div className="dos-dim" style={{ marginBottom: "0.25rem" }}>
              TEXT
            </div>
            <pre className="dos-literal">{post.text || "(empty)"}</pre>
          </div>
          <div className="dos-row-between">
            <button type="button" className="dos-button" onClick={onClose}>
              [ Close ]
            </button>
            <a
              href={url}
              target="_blank"
              rel="noreferrer"
              className="dos-button dos-button-accent"
            >
              [ View on X ]
            </a>
          </div>
          <p className="dos-dim" style={{ margin: 0, letterSpacing: "0.04em" }}>
            [ ENTER ] OPEN ON X &middot; [ ESC ] CLOSE
          </p>
        </div>
      </div>
    </div>
  );
}

function TextBar({ value, max }: { value: number; max: number }) {
  const width = 24;
  if (max <= 0) return <span className="dos-bar">{"".padEnd(width, " ")}</span>;
  const filled = Math.max(0, Math.min(width, Math.round((value / max) * width)));
  return (
    <span className="dos-bar">
      {"\u2588".repeat(filled)}
      {"\u2591".repeat(width - filled)}
    </span>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function isValidDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
