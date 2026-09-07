import sharp from "sharp";

async function processLogo() {
  const inputPath =
    "C:/Users/SokPhal/.gemini/antigravity/brain/4f674d03-5663-4b41-8a18-dcbf0ecab2d2/.user_uploaded/media_1788761604378.jpg";

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const w = metadata.width!;
  const h = metadata.height!;

  // First crop out the top status bar if needed (y starts at around 35 or 40)
  // Let's see how high the status bar is:
  const rawData = await image.ensureAlpha().raw().toBuffer();

  // Create a clean RGBA buffer
  const out = Buffer.from(rawData);

  // Analyze pixels
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = out[idx];
      const g = out[idx + 1];
      const b = out[idx + 2];

      // Top status bar artifact: if y < 45 and it's grey (r ≈ g ≈ b)
      if (y < 45 && Math.abs(r - g) < 15 && Math.abs(g - b) < 15 && r < 140) {
        out[idx + 3] = 0;
        continue;
      }

      // Check brightness and saturation
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      const delta = max - min;
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

      // Pure black / near black background
      if (max < 25) {
        out[idx + 3] = 0;
      } else if (max < 55 && delta < 20) {
        // Dark grey noise
        out[idx + 3] = 0;
      } else if (max < 80 && delta < 25) {
        // Smooth fade out
        const factor = (max - 40) / 40;
        out[idx + 3] = Math.min(255, Math.max(0, Math.round(factor * 255)));
      } else if (b > 60 && r > 40 && g < 40) {
        // Purple glow / aura: preserve!
        // If it's a soft purple glow on dark background, make alpha proportional to intensity
        const purpleIntensity = (r + b) / 2;
        if (purpleIntensity < 50) {
          out[idx + 3] = Math.round((purpleIntensity / 50) * 200);
        } else {
          out[idx + 3] = 255;
        }
      }
    }
  }

  // Trim transparent pixels
  const transparentPng = await sharp(out, {
    raw: { width: w, height: h, channels: 4 },
  })
    .trim({ threshold: 5 })
    .png({ quality: 100 })
    .toBuffer();

  await sharp(transparentPng).toFile("public/theziessstore-logo.png");
  await sharp(transparentPng).toFile("public/logo.png");
  console.log("Saved transparent logo to public/theziessstore-logo.png and public/logo.png");

  const finalMeta = await sharp(transparentPng).metadata();
  console.log("Final trimmed dimensions:", finalMeta.width, "x", finalMeta.height);
}

processLogo().catch(console.error);

