import type {
  AppData,
  PlainTransport,
  Producer,
  Router,
  TExternalStreamHandle,
} from "@sharkord/plugin-sdk";
import type { PlayerQueueEntry, PlayerStateSnapshot } from "../contract";
import type { TMusicStreamResult } from "./ffmpeg";

type TPlayableTrack = {
  sourceUrl: string;
  title?: string;
  artists?: string[];
  album?: string | null;
  coverUrl?: string | null;
  durationSeconds?: number | null;
};

type TQueueItem = {
  track: TPlayableTrack;
  invokerUserId: number;
};

type ChannelStreamState = {
  ffmpegProcess: TMusicStreamResult["process"] | null;
  audioProducer: Producer | null;
  audioTransport: PlainTransport<AppData> | null;
  router: Router<AppData> | null;
  streamHandle: TExternalStreamHandle | null;
  routerCloseHandler: ((...args: unknown[]) => void) | null;
  producerCloseHandler: ((...args: unknown[]) => void) | null;
  currentSong: string | null;
  currentArtists: string[];
  currentInvokerUserId: number | null;
  currentThumbnailUrl: string | null;
  streamActive: boolean;
  streamStarting: boolean;
  playbackStartedAtEpochMs: number | null;
  currentTrackDurationSeconds: number | null;
  streamGeneration: number;
  queue: TQueueItem[];
  endAction: "none" | "next" | "stop";
};

const channelStreams = new Map<number, ChannelStreamState>();

const createInitialState = (): ChannelStreamState => ({
  ffmpegProcess: null,
  audioProducer: null,
  audioTransport: null,
  router: null,
  streamHandle: null,
  routerCloseHandler: null,
  producerCloseHandler: null,
  currentSong: null,
  currentArtists: [],
  currentInvokerUserId: null,
  currentThumbnailUrl: null,
  streamActive: false,
  streamStarting: false,
  playbackStartedAtEpochMs: null,
  currentTrackDurationSeconds: null,
  streamGeneration: 0,
  queue: [],
  endAction: "none",
});

const getState = (channelId: number): ChannelStreamState => {
  let state = channelStreams.get(channelId);

  if (!state) {
    state = createInitialState();
    channelStreams.set(channelId, state);
  }

  return state;
};

const getExistingState = (channelId: number): ChannelStreamState | undefined =>
  channelStreams.get(channelId);

const formatSourceLabel = (sourceUrl: string): string => {
  if (sourceUrl.startsWith("ytsearch:")) {
    return sourceUrl.slice("ytsearch:".length);
  }

  return sourceUrl;
};

const formatTrackLabel = (track: TPlayableTrack): string => {
  const title = track.title?.trim() || formatSourceLabel(track.sourceUrl);
  const artists = track.artists?.filter(Boolean).join(" / ");

  return artists ? `${title} — ${artists}` : title;
};

const enqueueTrack = (
  channelId: number,
  track: TPlayableTrack,
  invokerUserId: number,
): number => {
  const state = getState(channelId);

  state.queue.push({ track, invokerUserId });

  return state.queue.length;
};

const takeNextFromQueue = (channelId: number): TQueueItem | null => {
  const state = getState(channelId);

  return state.queue.shift() ?? null;
};

const removeQueueItem = (
  channelId: number,
  position: number,
): TQueueItem | null => {
  const state = getState(channelId);
  const queueIndex = position - 1;

  if (
    !Number.isInteger(position) ||
    queueIndex < 0 ||
    queueIndex >= state.queue.length
  ) {
    return null;
  }

  const [removedItem] = state.queue.splice(queueIndex, 1);

  return removedItem ?? null;
};

const buildQueueEntries = (state: ChannelStreamState): PlayerQueueEntry[] =>
  state.queue.map((item, index) => ({
    position: index + 1,
    label: formatTrackLabel(item.track),
    title: item.track.title?.trim() || formatSourceLabel(item.track.sourceUrl),
    artists: item.track.artists ?? [],
    invokerUserId: item.invokerUserId,
  }));

const emptyPlayerStateSnapshot = (): PlayerStateSnapshot => ({
  currentSong: null,
  currentArtists: [],
  currentInvokerUserId: null,
  currentThumbnailUrl: null,
  streamActive: false,
  streamStarting: false,
  playbackStartedAtEpochMs: null,
  currentTrackDurationSeconds: null,
  queue: [],
});

const getPlayerStateSnapshot = (
  channelId?: number | null,
): PlayerStateSnapshot => {
  const state = channelId ? getExistingState(channelId) : undefined;

  if (!state) {
    return emptyPlayerStateSnapshot();
  }

  return {
    currentSong: state.currentSong,
    currentArtists: state.currentArtists,
    currentInvokerUserId: state.currentInvokerUserId,
    currentThumbnailUrl: state.currentThumbnailUrl,
    streamActive: state.streamActive,
    streamStarting: state.streamStarting,
    playbackStartedAtEpochMs: state.playbackStartedAtEpochMs,
    currentTrackDurationSeconds: state.currentTrackDurationSeconds,
    queue: buildQueueEntries(state),
  };
};

const getChannelIds = (): number[] => Array.from(channelStreams.keys());

const clearAllChannelStates = (): void => {
  channelStreams.clear();
};

export {
  clearAllChannelStates,
  emptyPlayerStateSnapshot,
  enqueueTrack,
  formatSourceLabel,
  formatTrackLabel,
  getChannelIds,
  getExistingState,
  getPlayerStateSnapshot,
  getState,
  removeQueueItem,
  takeNextFromQueue,
};
export type { ChannelStreamState, TPlayableTrack };
