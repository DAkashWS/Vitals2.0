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

  // "Inside VITALS" tunnel cards, one per module in src/content.ts, in the same order.
  // School and health photos from Unsplash (Unsplash License, free to use), except card 6:
  // school-6.jpg "Usain Bolt Rio 100m final 2016" by Fernando Frazão / Agência Brasil, CC BY 3.0 BR,
  // https://commons.wikimedia.org/wiki/File:Usain_Bolt_Rio_100m_final_2016k.jpg (cropped and resized).
  tunnel: [1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `media/school-${n}.jpg`),
};
