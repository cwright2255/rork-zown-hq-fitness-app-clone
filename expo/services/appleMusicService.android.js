// Real, new: Android has no MusicKit equivalent at all, so this file - the
// one Metro bundles into the Android build via its own platform-specific
// (.android.js) file resolution - never references the native package.
// Same public method names as services/appleMusicService.ios.js so the
// store can call either one safely regardless of platform.
class AppleMusicService {
  isSupported() {
    return false;
  }

  async authenticate() {
    return false;
  }

  async checkSubscription() {
    return { canPlayCatalogContent: false, canBecomeSubscriber: false };
  }

  async isAuthenticated() {
    return false;
  }

  async disconnect() {}

  async play() {}

  async pause() {}

  async next() {}

  async previous() {}

  async searchTracks() {
    return [];
  }

  async getCurrentlyPlaying() {
    return null;
  }
}

export const appleMusicService = new AppleMusicService();
