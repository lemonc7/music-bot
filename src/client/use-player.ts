import { useCanUseAction, usePush } from "@sharkord/plugin-sdk/client";
import { useCallback, useEffect, useState } from "react";
import type {
  PlayerStateSnapshot,
  TSharkord,
  TuneBoxProvider,
  TuneBoxTrack,
} from "../contract";
import { callAction, useCurrentVoiceChannelId } from "./store";

const EMPTY_PLAYER_STATE: PlayerStateSnapshot = {
  currentSong: null,
  currentArtists: [],
  currentInvokerUserId: null,
  currentThumbnailUrl: null,
  streamActive: false,
  streamStarting: false,
  playbackStartedAtEpochMs: null,
  currentTrackDurationSeconds: null,
  queue: [],
};

const getErrorMessage = (error: unknown): string =>
  error instanceof Error && error.message
    ? error.message
    : "Something went wrong.";

const formatDuration = (totalSeconds: number | null): string => {
  if (totalSeconds === null || !Number.isFinite(totalSeconds)) return "--:--";

  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${String(seconds).padStart(2, "0")}`;
};

const useElapsedSeconds = (player: PlayerStateSnapshot): number | null => {
  const startedAt = player.playbackStartedAtEpochMs;
  const isPlaying = player.streamActive && startedAt !== null;
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!isPlaying) return;

    setNow(Date.now());

    const interval = window.setInterval(() => setNow(Date.now()), 1000);

    return () => window.clearInterval(interval);
  }, [isPlaying, startedAt]);

  if (!isPlaying || startedAt === null) return null;

  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));

  return player.currentTrackDurationSeconds === null
    ? elapsed
    : Math.min(elapsed, player.currentTrackDurationSeconds);
};

const usePlayer = () => {
  const currentVoiceChannelId = useCurrentVoiceChannelId();
  // the server checks again on every call; this only keeps the UI honest
  const can = {

    search: useCanUseAction<TSharkord>("searchTuneBox"),
    playTrack: useCanUseAction<TSharkord>("playTuneBoxTrack"),
    skip: useCanUseAction<TSharkord>("nextMusic"),
    stop: useCanUseAction<TSharkord>("stopMusic"),
    jump: useCanUseAction<TSharkord>("jumpToQueueItem"),
    remove: useCanUseAction<TSharkord>("removeQueueItem"),
  };
  const [player, setPlayer] = useState(EMPTY_PLAYER_STATE);
  const [error, setError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<TuneBoxTrack[]>([]);
  const [activeSearch, setActiveSearch] = useState<{
    provider: TuneBoxProvider;
    query: string;
    page: number;
    total: number;
  } | null>(null);

  // the server pushes on every change, so nothing here polls
  usePush<TSharkord>(({ channelId, player: pushedPlayer }) => {
    if (channelId !== currentVoiceChannelId) return;

    setPlayer(pushedPlayer);
  });

  useEffect(() => {
    setError("");
    setSearchResults([]);
    setActiveSearch(null);

    if (!currentVoiceChannelId) {
      setPlayer(EMPTY_PLAYER_STATE);

      return;
    }

    let cancelled = false;

    callAction("getPlayerState")
      .then((state) => {
        if (!cancelled) setPlayer(state);
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [currentVoiceChannelId]);

  const run = useCallback(
    async (
      call: () => Promise<{ message: string; player: PlayerStateSnapshot }>,
    ) => {
      setIsBusy(true);

      try {
        const response = await call();

        setPlayer(response.player);
        // the panel already shows what changed, so only failures are worth text
        setError("");
      } catch (err) {
        setError(getErrorMessage(err));
      } finally {
        setIsBusy(false);
      }
    },
    [],
  );

  const search = useCallback(
    async (query: string, provider: TuneBoxProvider) => {
      setIsSearching(true);

      try {
        const response = await callAction("searchTuneBox", {
          provider,
          query,
          page: 1,
        });

        setSearchResults(response.tracks);
        setActiveSearch({
          provider,
          query,
          page: response.page,
          total: response.total,
        });
        setError("");
      } catch (err) {
        setError(getErrorMessage(err));
        setSearchResults([]);
        setActiveSearch(null);
      } finally {
        setIsSearching(false);
      }
    },
    [],
  );

  const loadMore = useCallback(async () => {
    if (
      !activeSearch ||
      isSearching ||
      searchResults.length >= activeSearch.total
    ) {
      return;
    }

    setIsSearching(true);

    try {
      const nextPage = activeSearch.page + 1;
      const response = await callAction("searchTuneBox", {
        provider: activeSearch.provider,
        query: activeSearch.query,
        page: nextPage,
      });

      setSearchResults((current) => {
        const existing = new Set(
          current.map((track) => `${track.provider}:${track.id}`),
        );
        const additions = response.tracks.filter((track) => {
          const key = `${track.provider}:${track.id}`;

          if (existing.has(key)) return false;

          existing.add(key);
          return true;
        });

        return [...current, ...additions];
      });
      setActiveSearch((current) =>
        current
          ? {
              ...current,
              page: Math.max(nextPage, response.page),
              total: response.total,
            }
          : null,
      );
      setError("");
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setIsSearching(false);
    }
  }, [activeSearch, isSearching, searchResults.length]);

  const elapsedSeconds = useElapsedSeconds(player);
  const duration = player.currentTrackDurationSeconds;
  const progressPercent =
    elapsedSeconds !== null && duration !== null && duration > 0
      ? Math.min(100, (elapsedSeconds / duration) * 100)
      : 0;

  return {
    can,
    elapsedSeconds,
    error,
    isBusy,
    isSearching,
    isDisconnected: !currentVoiceChannelId,
    hasMoreSearchResults:
      activeSearch !== null && searchResults.length < activeSearch.total,

    loadMore,
    playTrack: (track: TuneBoxTrack) =>
      run(() => callAction("playTuneBoxTrack", { track })),
    player,
    progressPercent,
    remove: (position: number) =>
      run(() => callAction("removeQueueItem", { position })),
    search,
    searchResults,
    jumpTo: (position: number) =>
      run(() => callAction("jumpToQueueItem", { position })),
    skip: () => run(() => callAction("nextMusic")),
    stop: () => run(() => callAction("stopMusic")),
  };
};

export { formatDuration, usePlayer };
