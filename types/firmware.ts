// Types for Firmware Management

export interface FirmwareVersion {
  major: number;
  minor: number;
  patch: number;
  versionString: string;
  buildDate?: string;
}

export interface BoardInfo {
  identifier: string;
  targetName: string;
  boardName: string;
  manufacturerId: string;
}

export interface FirmwareInfo {
  current: FirmwareVersion;
  board: BoardInfo;
  apiVersion: string;
}

export interface GitHubRelease {
  tag_name: string;
  name: string;
  published_at: string;
  body: string;
  assets: GitHubAsset[];
  html_url: string;
  prerelease: boolean;
}

export interface GitHubAsset {
  name: string;
  browser_download_url: string;
  size: number;
}

export interface FirmwareUpdateInfo {
  current: FirmwareVersion;
  latest: GitHubRelease | null;
  updateAvailable: boolean;
  targetFirmwareUrl?: string;
}

export interface ConfigDump {
  version: string;
  timestamp: Date;
  settings: Record<string, string | number | boolean>;
  cliDump: string;
}
