/**
 * Ambient global augmentation for the two configuration slots the library
 * writes at runtime — see videoConfiguration.ts::initializeGlobalConfig,
 * which is the single source of truth for these shapes.
 */

import type {
  NrVideoBrowserInfo,
  NrVideoBrowserConfig,
  NrVideoCdInfo,
  NrVideoCdConfig,
} from "./videoConfiguration";

declare global {
  interface Window {
    NRVIDEO?: { info: NrVideoBrowserInfo; config: NrVideoBrowserConfig };
  }

  // eslint-disable-next-line no-var
  var __NRVIDEO_CD__:
    | { info: NrVideoCdInfo; config: NrVideoCdConfig }
    | undefined;
}

export {};
