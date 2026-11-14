export class ReaderNotice extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReaderNotice';
  }
}

export const CHAPTER_WAITING = 'This chapter is taking a little longer. It will open on its own.';
export const CHAPTER_GAVE_UP = "This chapter didn't load. Try again in a little while.";
export const CHAPTER_UNAVAILABLE = 'This translation is not available to read in Journeys.';
export const CHAPTER_OFFLINE = "You're offline. Your downloaded versions are still here.";
export const DOWNLOAD_PAUSED = 'The download paused. Chapters already saved are on this device. Tap Download to continue.';
export const DOWNLOAD_FAILED = "The download didn't finish. Chapters already saved are on this device. Tap Download to continue.";
export const VERSION_LIST_FAILED = "Couldn't load the version list. Try again in a little while.";
export const LANGUAGE_LIST_FAILED = "Couldn't load the language list. Try again in a little while.";
