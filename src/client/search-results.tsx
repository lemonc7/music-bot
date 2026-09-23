import type { TuneBoxTrack } from "../contract";
import { NoteIcon, PlayIcon } from "./icons";

type SearchResultsProps = {
  tracks: TuneBoxTrack[];
  isBusy: boolean;
  canPlay: boolean;
  isPlaying: boolean;
  hasMore: boolean;
  isLoadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (track: TuneBoxTrack) => void;
};

const SearchResults = ({
  tracks,
  isBusy,
  canPlay,
  isPlaying,
  hasMore,
  isLoadingMore,
  onLoadMore,
  onSelect,
}: SearchResultsProps) => {
  if (tracks.length === 0) return null;

  return (
    <div className="mb-section mb-results">
      <div className="mb-section-head">
        <span className="mb-section-title">Search results</span>
        <span className="mb-section-count">{tracks.length} tracks</span>
      </div>

      <ul className="mb-list">
        {tracks.map((track) => {
          const artists = track.artists.join(" / ") || "Unknown artist";

          return (
            <li
              className="mb-result"
              key={`${track.provider}-${track.id}`}
            >
              <div className="mb-result-art">
                {track.coverUrl ? (
                  <img src={track.coverUrl} alt="" />
                ) : (
                  <NoteIcon size={18} />
                )}
              </div>

              <div className="mb-result-copy">
                <div className="mb-row-label">{track.title}</div>
                <div className="mb-row-meta">
                  {artists}
                  {track.album ? ` · ${track.album}` : ""}
                </div>
              </div>

              <button
                type="button"
                className="mb-result-play"
                disabled={isBusy || !canPlay}
                title={isPlaying ? "Add to queue" : "Play now"}
                aria-label={`${isPlaying ? "Queue" : "Play"} ${track.title}`}
                onClick={() => onSelect(track)}
              >
                <PlayIcon size={13} />
                {isPlaying ? "Queue" : "Play"}
              </button>
            </li>
          );
        })}

        {hasMore ? (
          <li className="mb-load-more-row">
            <button
              type="button"
              className="mb-load-more"
              disabled={isLoadingMore}
              onClick={onLoadMore}
            >
              {isLoadingMore ? "Loading..." : "Load more"}
            </button>
          </li>
        ) : null}
      </ul>
    </div>
  );
};

export { SearchResults };
