import sharp from "sharp";
const out = process.argv[2];
const mark = (size, fg, bg, pad) => {
  const s = size, p = s * pad, L = s * 0.2, w = s * 0.045, c = s / 2, r = s * 0.13;
  const corner = (x, y, dx, dy) => `<path d="M${x} ${y + dy * L}V${y}H${x + dx * L}" fill="none" stroke="${fg}" stroke-width="${w}" stroke-linecap="square"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}">${bg ? `<rect width="100%" height="100%" fill="${bg}"/>` : ""}
    ${corner(p, p, 1, 1)}${corner(s - p, p, -1, 1)}${corner(p, s - p, 1, -1)}${corner(s - p, s - p, -1, -1)}
    <circle cx="${c}" cy="${c}" r="${r}" fill="#E2531B"/></svg>`;
};
const save = (svg, file) => sharp(Buffer.from(svg)).png().toFile(`${out}/${file}`);
await save(mark(1024, "#F4F1EA", "#141310", 0.2), "icon.png");
await save(mark(1024, "#141310", null, 0.3), "android-icon-foreground.png");
await save(`<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="#F4F1EA"/></svg>`, "android-icon-background.png");
await save(mark(1024, "#000000", null, 0.3), "android-icon-monochrome.png");
await save(mark(400, "#141310", null, 0.15), "splash-icon.png");
await save(mark(64, "#141310", "#F4F1EA", 0.14), "favicon.png");
console.log("ok");
