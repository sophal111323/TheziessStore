import sharp from "sharp";

async function extractSubject() {
  const inputPath =
    "C:/Users/SokPhal/.gemini/antigravity/brain/4f674d03-5663-4b41-8a18-dcbf0ecab2d2/.user_uploaded/media_1788761604378.jpg";

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const w = metadata.width!;
  const h = metadata.height!;

  const raw = await image.ensureAlpha().raw().toBuffer();
  const out = Buffer.from(raw);

  // We want to detect background vs foreground.
  // For each pixel:
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = out[idx];
      const g = out[idx + 1];
      const b = out[idx + 2];

      // 1. Top screenshot bar: y < 60
      if (y < 60) {
        out[idx + 3] = 0;
        continue;
      }

      // 2. Bottom margin below the text: y > 680
      if (y > 678) {
        out[idx + 3] = 0;
        continue;
      }

      // 3. Left / Right outer margins
      if (x < 30 || x > w - 30) {
        out[idx + 3] = 0;
        continue;
      }

      // 4. Character core protection zone:
      // Inside this zone, the mask and black clothing must remain 100% opaque!
      const isInsideCharacter =
        x >= 280 && x <= 550 && y >= 70 && y <= 580;
      
      // Inside text zone:
      const isInsideText =
        x >= 120 && x <= 710 && y >= 570 && y <= 678;

      if (isInsideCharacter) {
        // Only make transparent if it's completely outside the head/body (pure black < 15)
        // Check if it's the black mask/clothes or actual character
        if (y < 350 && Math.max(r, g, b) < 15) {
          // background between hair strands
          out[idx + 3] = 0;
        } else {
          out[idx + 3] = 255;
        }
        continue;
      }

      if (isInsideText) {
        // Text is white/grey with black shadow outline
        // If it's part of the text letters or immediate drop shadow:
        const maxVal = Math.max(r, g, b);
        if (maxVal > 50) {
          out[idx + 3] = 255;
        } else if (maxVal > 20) {
          // text shadow
          out[idx + 3] = Math.round(((maxVal - 20) / 30) * 255);
        } else {
          out[idx + 3] = 0;
        }
        continue;
      }

      // 5. Outside character and text: This is the purple wings/flames and black background.
      // The purple wings have high saturation: high blue and red, low green.
      const purpleStrength = (r + b) / 2 - g;
      const maxVal = Math.max(r, g, b);

      if (purpleStrength > 60 && maxVal > 90) {
        // Solid vibrant purple wing / crest
        out[idx + 3] = 255;
      } else if (purpleStrength > 30 && maxVal > 50) {
        // Glowing purple wing edge: smooth alpha
        const alphaFactor = Math.min(1.0, (maxVal - 40) / 60);
        out[idx + 3] = Math.round(alphaFactor * 255);
      } else {
        // Background black / faint dust / dark streaks
        out[idx + 3] = 0;
      }
    }
  }

  // Smooth blur filter on alpha channel only to make cutouts smooth and anti-aliased
  const alphaCopy = Buffer.from(out);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = (y * w + x) * 4 + 3;
      const current = alphaCopy[idx];
      if (current > 0 && current < 255) {
        // Average with 4 neighbors for soft edges
        const n1 = alphaCopy[((y - 1) * w + x) * 4 + 3];
        const n2 = alphaCopy[((y + 1) * w + x) * 4 + 3];
        const n3 = alphaCopy[(y * w + (x - 1)) * 4 + 3];
        const n4 = alphaCopy[(y * w + (x + 1)) * 4 + 3];
        out[idx] = Math.round((current * 2 + n1 + n2 + n3 + n4) / 6);
      }
    }
  }

  // Trim transparent pixels
  const trimmed = await sharp(out, {
    raw: { width: w, height: h, channels: 4 },
  })
    .trim({ threshold: 10 })
    .png({ quality: 100 })
    .toBuffer();

  const meta = await sharp(trimmed).metadata();
  console.log(`Successfully trimmed: ${meta.width}x${meta.height}`);

  await sharp(trimmed).toFile("public/theziessstore-logo.png");
  await sharp(trimmed).toFile("public/logo.png");
  console.log("Saved to public/theziessstore-logo.png and public/logo.png!");
}

extractSubject().catch(console.error);

