/**
 * Minimal emoji shortcode → character map for markdown :shortcode: syntax.
 * Curated subset of the most common shortcodes used in tech presentations —
 * not exhaustive. Add entries as needed; the object is plain and extensible.
 */
window.EMOJI_MAP = {
  // Faces & gestures
  smile: '\u{1F642}', grin: '\u{1F600}', joy: '\u{1F602}', laughing: '\u{1F606}',
  wink: '\u{1F609}', heart_eyes: '\u{1F60D}', sunglasses: '\u{1F60E}',
  thinking: '\u{1F914}', neutral_face: '\u{1F610}', worried: '\u{1F61F}',
  cry: '\u{1F622}', sob: '\u{1F62D}', angry: '\u{1F620}', rage: '\u{1F621}',
  scream: '\u{1F631}', exploding_head: '\u{1F92F}', partying_face: '\u{1F973}',
  thumbsup: '\u{1F44D}', '+1': '\u{1F44D}', thumbsdown: '\u{1F44E}', '-1': '\u{1F44E}',
  ok_hand: '\u{1F44C}', clap: '\u{1F44F}', raised_hands: '\u{1F64C}',
  pray: '\u{1F64F}', muscle: '\u{1F4AA}', wave: '\u{1F44B}', point_right: '\u{1F449}',
  point_left: '\u{1F448}', point_up: '\u{1F446}', point_down: '\u{1F447}',

  // Hearts & symbols
  heart: '\u2764\uFE0F', broken_heart: '\u{1F494}', sparkling_heart: '\u{1F496}',
  star: '\u2B50', star2: '\u{1F31F}', sparkles: '\u2728', fire: '\u{1F525}',
  boom: '\u{1F4A5}', zap: '\u26A1', sunny: '\u2600\uFE0F', cloud: '\u2601\uFE0F',
  snowflake: '\u2744\uFE0F', umbrella: '\u2614', rainbow: '\u{1F308}',

  // Check & cross
  white_check_mark: '\u2705', heavy_check_mark: '\u2714\uFE0F',
  check: '\u2705', x: '\u274C', heavy_multiplication_x: '\u2716\uFE0F',
  warning: '\u26A0\uFE0F', no_entry: '\u26D4', no_entry_sign: '\u{1F6AB}',
  bangbang: '\u203C\uFE0F', exclamation: '\u2757', question: '\u2753',
  grey_question: '\u2754', grey_exclamation: '\u2755',

  // Tech
  computer: '\u{1F4BB}', desktop_computer: '\u{1F5A5}\uFE0F',
  keyboard: '\u2328\uFE0F', mouse: '\u{1F5B1}\uFE0F', floppy_disk: '\u{1F4BE}',
  cd: '\u{1F4BF}', iphone: '\u{1F4F1}', phone: '\u260E\uFE0F',
  email: '\u2709\uFE0F', envelope: '\u2709\uFE0F', inbox_tray: '\u{1F4E5}',
  outbox_tray: '\u{1F4E4}', package: '\u{1F4E6}', link: '\u{1F517}',
  lock: '\u{1F512}', unlock: '\u{1F513}', key: '\u{1F511}',
  mag: '\u{1F50D}', bulb: '\u{1F4A1}', wrench: '\u{1F527}', hammer: '\u{1F528}',
  gear: '\u2699\uFE0F', robot: '\u{1F916}', rocket: '\u{1F680}',
  satellite: '\u{1F6F0}\uFE0F', battery: '\u{1F50B}', electric_plug: '\u{1F50C}',

  // Arrows
  arrow_right: '\u27A1\uFE0F', arrow_left: '\u2B05\uFE0F',
  arrow_up: '\u2B06\uFE0F', arrow_down: '\u2B07\uFE0F',
  arrow_upper_right: '\u2197\uFE0F', arrow_upper_left: '\u2196\uFE0F',
  arrow_lower_right: '\u2198\uFE0F', arrow_lower_left: '\u2199\uFE0F',
  leftwards_arrow_with_hook: '\u21A9\uFE0F',
  arrow_right_hook: '\u21AA\uFE0F',

  // Office & work
  memo: '\u{1F4DD}', pencil: '\u270F\uFE0F', pencil2: '\u270F\uFE0F',
  page_with_curl: '\u{1F4C3}', page_facing_up: '\u{1F4C4}',
  notebook: '\u{1F4D3}', book: '\u{1F4D6}', books: '\u{1F4DA}',
  clipboard: '\u{1F4CB}', calendar: '\u{1F4C5}', chart_with_upwards_trend: '\u{1F4C8}',
  chart_with_downwards_trend: '\u{1F4C9}', bar_chart: '\u{1F4CA}',
  briefcase: '\u{1F4BC}', file_folder: '\u{1F4C1}', open_file_folder: '\u{1F4C2}',

  // Transport
  car: '\u{1F697}', bus: '\u{1F68C}', train: '\u{1F686}', airplane: '\u2708\uFE0F',
  ship: '\u{1F6A2}', bicycle: '\u{1F6B2}', walking: '\u{1F6B6}',

  // Food
  coffee: '\u2615', tea: '\u{1F375}', beer: '\u{1F37A}', wine_glass: '\u{1F377}',
  pizza: '\u{1F355}', hamburger: '\u{1F354}', cake: '\u{1F370}',
  apple: '\u{1F34E}', banana: '\u{1F34C}',

  // Weather / nature
  earth_americas: '\u{1F30E}', earth_africa: '\u{1F30D}', earth_asia: '\u{1F30F}',
  moon: '\u{1F31A}', sun: '\u2600\uFE0F', milky_way: '\u{1F30C}',

  // Misc
  tada: '\u{1F389}', confetti_ball: '\u{1F38A}', trophy: '\u{1F3C6}',
  medal: '\u{1F3C5}', crown: '\u{1F451}', gift: '\u{1F381}',
  eyes: '\u{1F440}', ear: '\u{1F442}', brain: '\u{1F9E0}',
  bomb: '\u{1F4A3}', skull: '\u{1F480}', ghost: '\u{1F47B}',
  alien: '\u{1F47D}', poop: '\u{1F4A9}', shit: '\u{1F4A9}',
  hourglass: '\u231B', hourglass_flowing_sand: '\u23F3',
  alarm_clock: '\u23F0', stopwatch: '\u23F1\uFE0F', clock: '\u{1F550}',
  pushpin: '\u{1F4CC}', round_pushpin: '\u{1F4CD}',
  triangular_flag_on_post: '\u{1F6A9}', checkered_flag: '\u{1F3C1}',
  white_flag: '\u{1F3F3}\uFE0F', black_flag: '\u{1F3F4}',
  recycle: '\u267B\uFE0F', infinity: '\u267E\uFE0F',
  copyright: '\u00A9\uFE0F', registered: '\u00AE\uFE0F', tm: '\u2122\uFE0F',
};
