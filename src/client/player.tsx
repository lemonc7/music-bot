import { Button, Popover, PopoverContent, PopoverTrigger } from "@sharkord/ui";
import { memo, useState } from "react";
import type { TuneBoxProvider } from "../contract";
import {
  NoteIcon,
  PlayIcon,
  SearchIcon,
  SkipIcon,
  StopIcon,
} from "./icons";
import { Queue } from "./queue";
import { SearchResults } from "./search-results";
import { useUserName } from "./store";
import { panelStyle } from "./styles";
import { formatDuration, usePlayer } from "./use-player";

type PlayerPanelProps = {
  controller: ReturnType<typeof usePlayer>;
};

const PlayerPanel = ({ controller }: PlayerPanelProps) => {
  const {
    can,
    elapsedSeconds,
    error,
    isBusy,
    isSearching,
    hasMoreSearchResults,
    jumpTo,
    loadMore,
    playTrack,
    player,
    progressPercent,
    remove,
    search,
    searchResults,
    skip,
    stop,
  } = controller;
  const [query, setQuery] = useState("");
  const [provider, setProvider] = useState<TuneBoxProvider>("netease");

  const addedBy = useUserName(player.currentInvokerUserId);
  const currentArtists = player.currentArtists.join(" / ");

  const isPlaying = player.streamActive;
  const isLoading = player.streamStarting;
  const canSubmit =
    query.trim() !== "" && !isSearching && can.search;

  const submit = () => {
    if (!canSubmit) return;

    search(query.trim(), provider);
  };

  const title = isPlaying
    ? (player.currentSong ?? "Unknown track")
    : isLoading
      ? "Starting playback..."
      : "Nothing playing";

  return (
    <div className="mb-panel">
      <div className="mb-search">
        <select
          className="mb-provider-select"
          value={provider}
          aria-label="Music provider"
          disabled={!can.search || isSearching}
          onChange={(event) =>
            setProvider(event.target.value as TuneBoxProvider)
          }
        >
          <option value="netease">网易云</option>
          <option value="kuwo">酷我</option>
        </select>

        <div className="mb-search-field">
          <SearchIcon />
          <input
            className="mb-search-input"
            value={query}
            placeholder="Search Tune Box"
            aria-label="Search Tune Box"
            disabled={!can.search}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== "Enter") return;

              event.preventDefault();
              submit();
            }}
          />
        </div>

        <button
          type="button"
          className="mb-add"
          disabled={!canSubmit}
          onClick={submit}
        >
          {isSearching ? "Searching" : "Search"}
        </button>
      </div>

      <div className="mb-hero">
        <div className="mb-art">
          {player.currentThumbnailUrl ? (
            <img src={player.currentThumbnailUrl} alt="" />
          ) : (
            <span className="mb-art-fallback">
              <NoteIcon size={34} />
            </span>
          )}
        </div>

        <div>
          <div
            className={isPlaying ? "mb-eyebrow" : "mb-eyebrow mb-eyebrow-idle"}
          >
            {isPlaying ? "Now playing" : "Idle"}
          </div>
          <div className="mb-title">{title}</div>
          <div className="mb-sub">
            {!can.playTrack
              ? "You cannot control the player"
              : isPlaying && currentArtists
                ? currentArtists
                : isPlaying && addedBy
                  ? `Added by ${addedBy}`
                  : "Search Tune Box to start the queue"}
          </div>
        </div>
      </div>

      <div className="mb-progress">
        <div className="mb-bar">
          <div
            className="mb-bar-fill"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="mb-times">
          <span>{formatDuration(elapsedSeconds)}</span>
          <span>{formatDuration(player.currentTrackDurationSeconds)}</span>
        </div>
      </div>

      <div className="mb-controls">
        <div className="mb-transport">
          <button
            type="button"
            className="mb-ctrl mb-ctrl-main"
            title={isPlaying ? "Stop" : "Nothing to stop"}
            aria-label={isPlaying ? "Stop playback" : "Nothing to stop"}
            disabled={isBusy || !isPlaying || !can.stop}
            onClick={stop}
          >
            {isPlaying ? <StopIcon size={20} /> : <PlayIcon size={22} />}
          </button>

          <button
            type="button"
            className="mb-ctrl"
            title="Skip to the next track"
            aria-label="Skip to the next track"
            disabled={
              isBusy || !can.skip || (!isPlaying && player.queue.length === 0)
            }
            onClick={skip}
          >
            <SkipIcon size={22} />
          </button>
        </div>
      </div>

      {error ? <div className="mb-note">{error}</div> : null}

      <SearchResults
        tracks={searchResults}
        isBusy={isBusy}
        canPlay={can.playTrack}
        isPlaying={isPlaying || isLoading}
        hasMore={hasMoreSearchResults}
        isLoadingMore={isSearching && searchResults.length > 0}
        onLoadMore={loadMore}
        onSelect={playTrack}
      />

      {player.queue.length > 0 ? (
        <Queue
          queue={player.queue}
          isBusy={isBusy}
          canJump={can.jump}
          canRemove={can.remove}
          onJump={jumpTo}
          onRemove={remove}
        />
      ) : (
        <div className="mb-empty">The queue is empty.</div>
      )}
    </div>
  );
};

const Player = memo(() => {
  const [open, setOpen] = useState(false);
  const controller = usePlayer();

  // every control needs a voice channel to act on, so out of one there is
  // nothing the panel could do: the whole button goes away
  if (controller.isDisconnected) return null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Music player"
          style={{ position: "relative" }}
        >
          <NoteIcon size={20} />
          {controller.player.streamActive ? <span className="mb-dot" /> : null}
        </Button>
      </PopoverTrigger>

      <PopoverContent align="end" style={panelStyle}>
        <PlayerPanel controller={controller} />
      </PopoverContent>
    </Popover>
  );
});

export { Player };
