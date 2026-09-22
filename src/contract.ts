type TuneBoxTrack = {
  id: string;
  provider: string;
  title: string;
  artists: string[];
  album: string | null;
  coverUrl: string | null;
  durationSeconds: number | null;
};

type TuneBoxSearchResult = {
  tracks: TuneBoxTrack[];
  page: number;
  total: number;
};

type PlayerQueueEntry = {
  position: number;
  label: string;
  title: string;
  artists: string[];
  invokerUserId: number;
};

type PlayerStateSnapshot = {
  currentSong: string | null;
  currentArtists: string[];
  currentInvokerUserId: number | null;
  currentThumbnailUrl: string | null;
  streamActive: boolean;
  streamStarting: boolean;
  playbackStartedAtEpochMs: number | null;
  currentTrackDurationSeconds: number | null;
  volume: number;
  queue: PlayerQueueEntry[];
};

type PlayerActionResponse = {
  message: string;
  player: PlayerStateSnapshot;
};

type TSharkord = {
  actions: {
    getPlayerState: {
      payload: void;
      response: PlayerStateSnapshot;
    };

    searchTuneBox: {
      payload: { query: string; page?: number };
      response: TuneBoxSearchResult;
    };
    playTuneBoxTrack: {
      payload: { track: TuneBoxTrack };
      response: PlayerActionResponse;
    };
    removeQueueItem: {
      payload: { position: number };
      response: PlayerActionResponse;
    };
    nextMusic: {
      payload: void;
      response: PlayerActionResponse;
    };
    jumpToQueueItem: {
      payload: { position: number };
      response: PlayerActionResponse;
    };
    stopMusic: {
      payload: void;
      response: PlayerActionResponse;
    };
    setVolume: {
      payload: { volume: number };
      response: PlayerActionResponse;
    };
  };
  commands: {
    "update-ffmpeg": {
      args: void;
      response: string;
    };

  };
  push: {
    channelId: number;
    player: PlayerStateSnapshot;
  };
};

export type {
  PlayerActionResponse,
  PlayerQueueEntry,
  PlayerStateSnapshot,
  TSharkord,
  TuneBoxSearchResult,
  TuneBoxTrack,
};
