/*
 * Every image and video the site shows, in one place.
 *
 * All files live in /public/media/ and ship with the site, so it works with no
 * internet. They are placeholder space photos (from Unsplash) until the
 * Seedance 2.0 clips are ready. To swap one in, drop the file into
 * /public/media/ and change the value here, for example:
 *   missionVideo: "media/mission-61-4.mp4"
 * Keep paths relative (no leading slash) so the site works on GitHub Pages.
 */

export const media = {
  // Glyph Portal hero: shows through the letters of "VITALS".
  heroField: "media/hero-earth.jpg",

  // Scroll Expansion hero ("Mission 61:4"). Seedance slot: set missionVideo
  // to a clip and missionType to "video"; missionPoster is shown while it loads.
  missionType: "image" as "image" | "video",
  missionVideo: "",
  missionPoster: "media/mission.jpg",
  missionImage: "media/mission.jpg",
  missionBackground: "media/mission-bg.jpg",

  // Perspective Tunnel cards, in order (the 10th, Space Medicines, reuses the Earth photo).
  // (tunnel-6.jpg belonged to the removed Radiation card, so it's skipped and every card keeps its photo)
  tunnel: [1, 2, 3, 4, 5, 7, 8, 9].map((n) => `media/tunnel-${n}.jpg`).concat("media/hero-earth.jpg"),
};
