export const ALLOWED_EXTENSIONS = [
  '.mp3', '.wav', '.m4a', '.flac', '.aac', '.ogg', '.opus', '.wma',
  '.mp4', '.mkv', '.mov', '.webm', '.avi', '.flv'
];

export const MAX_FILE_SIZE_BYTES = 2 * 1024 * 1024 * 1024;

export const ACCEPT_FILE_TYPES = 'audio/*,video/*,' + ALLOWED_EXTENSIONS.join(',');
