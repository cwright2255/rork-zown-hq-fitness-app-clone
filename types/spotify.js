// Spotify type definitions converted to JSDoc comments for better IDE support

/**
 * @typedef {Object} SpotifyTrack
 * @property {string} id
 * @property {string} name
 * @property {SpotifyArtist[]} artists
 * @property {SpotifyAlbum} album
 * @property {number} duration_ms
 * @property {string|null} preview_url
 * @property {Object} external_urls
 * @property {string} external_urls.spotify
 * @property {string} uri
 */

/**
 * @typedef {Object} SpotifyArtist
 * @property {string} id
 * @property {string} name
 * @property {Object} external_urls
 * @property {string} external_urls.spotify
 */

/**
 * @typedef {Object} SpotifyAlbum
 * @property {string} id
 * @property {string} name
 * @property {SpotifyImage[]} images
 */

/**
 * @typedef {Object} SpotifyImage
 * @property {string} url
 * @property {number} height
 * @property {number} width
 */

/**
 * @typedef {Object} SpotifyPlaylist
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {SpotifyImage[]} images
 * @property {Object} tracks
 * @property {number} tracks.total
 * @property {Object} external_urls
 * @property {string} external_urls.spotify
 * @property {string} uri
 */

/**
 * @typedef {Object} SpotifyUser
 * @property {string} id
 * @property {string|null} display_name
 * @property {string} [email]
 * @property {SpotifyImage[]} images
 * @property {Object} followers
 * @property {string|null} [followers.href]
 * @property {number} followers.total
 * @property {string} [country]
 * @property {Object} [explicit_content]
 * @property {boolean} [explicit_content.filter_enabled]
 * @property {boolean} [explicit_content.filter_locked]
 * @property {Object} external_urls
 * @property {string} external_urls.spotify
 * @property {string} href
 * @property {string} [product]
 * @property {string} type
 * @property {string} uri
 */

/**
 * @typedef {Object} SpotifyAuthResponse
 * @property {string} access_token
 * @property {string} token_type
 * @property {number} expires_in
 * @property {string} [refresh_token]
 * @property {string} scope
 */

/**
 * @typedef {Object} SpotifyPlaybackState
 * @property {boolean} is_playing
 * @property {number} progress_ms
 * @property {SpotifyTrack|null} item
 * @property {boolean} shuffle_state
 * @property {'off'|'track'|'context'} repeat_state
 */

/**
 * @typedef {Object} WorkoutMusicPreferences
 * @property {string[]} preferredGenres
 * @property {number} energyLevel - 0-1
 * @property {Object} tempoRange
 * @property {number} tempoRange.min
 * @property {number} tempoRange.max
 * @property {boolean} explicitContent
 */

// Export empty object for module compatibility
export {};