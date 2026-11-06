import sharp from "sharp";

async function makeCleanLogo() {
  const inputPath =
    "C:/Users/SokPhal/.gemini/antigravity/brain/4f674d03-5663-4b41-8a18-dcbf0ecab2d2/.user_uploaded/media_1788761604378.jpg";

  const image = sharp(inputPath);
  const metadata = await image.metadata();
  const w = metadata.width!;
  const h = metadata.height!;

  const raw = await image.ensureAlpha().raw().toBuffer();

  // We will build an alpha mask (Float32Array for smooth anti-aliasing)
  const alpha = new Float32Array(w * h);

  // Initialize: 1.0 (fully opaque)
  alpha.fill(1.0);

  // Helper to get pixel RGB
  function getRGB(x: number, y: number) {
    const idx = (y * w + x) * 4;
    return [raw[idx], raw[idx + 1], raw[idx + 2]];
  }

  // Is this pixel part of the outer background?
  function isOuterBgCandidate(x: number, y: number) {
    const [r, g, b] = getRGB(x, y);
    const maxVal = Math.max(r, g, b);
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    // Top status bar artifact
    if (y < 45 && Math.abs(r - g) < 20 && Math.abs(g - b) < 20 && brightness < 130) {
      return true;
    }

    // Near black
    if (maxVal < 35) return true;

    // Dark grey/purple background noise
    if (brightness < 35 && maxVal < 60) return true;

    // Outer faint purple glow/streaks in dark background
    // (if not near the character center)
    const distFromCenter = Math.hypot(x - w / 2, y - h / 2);
    if (distFromCenter > 280) {
      if (brightness < 45 && maxVal < 90) return true;
      if (maxVal < 65) return true;
    }

    return false;
  }

  // BFS Queue for outer background flood fill
  const visited = new Uint8Array(w * h);
  const queue: number[] = [];

  // Seed with all border pixels
  for (let x = 0; x < w; x++) {
    // Top border
    queue.push(x, 0);
    visited[0 * w + x] = 1;
    // Bottom border
    queue.push(x, h - 1);
    visited[(h - 1) * w + x] = 1;
  }
  for (let y = 0; y < h; y++) {
    // Left border
    if (!visited[y * w + 0]) {
      queue.push(0, y);
      visited[y * w + 0] = 1;
    }
    // Right border
    if (!visited[y * w + (w - 1)]) {
      queue.push(w - 1, y);
      visited[y * w + (w - 1)] = 1;
    }
  }

  let head = 0;
  while (head < queue.length) {
    const x = queue[head++];
    const y = queue[head++];

    if (isOuterBgCandidate(x, y)) {
      // Mark as transparent
      alpha[y * w + x] = 0;

      // Check 4 neighbors
      const neighbors = [
        [x + 1, y],
        [x - 1, y],
        [x, y + 1],
        [x, y - 1],
      ];

      for (const [nx, ny] of neighbors) {
        if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
          const nidx = ny * w + nx;
          if (!visited[nidx]) {
            visited[nidx] = 1;
            queue.push(nx, ny);
          }
        }
      }
    }
  }

  // Smooth anti-aliased border feathering for alpha transitions
  const feathered = new Float32Array(alpha);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (alpha[idx] === 0) {
        continue;
      }

      // Check if neighboring transparent pixel
      let hasZeroNeighbor = false;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (alpha[(y + dy) * w + (x + dx)] === 0) {
            hasZeroNeighbor = true;
            break;
          }
        }
        if (hasZeroNeighbor) break;
      }

      if (hasZeroNeighbor) {
        const [r, g, b] = getRGB(x, y);
        const maxVal = Math.max(r, g, b);
        const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
        // Soft feathering
        feathered[idx] = Math.min(1.0, Math.max(0.1, (maxVal - 20) / 100));
      }
    }
  }

  // Apply to output buffer
  const outBuffer = Buffer.from(raw);
  for (let i = 0; i < w * h; i++) {
    outBuffer[i * 4 + 3] = Math.round(feathered[i] * 255);
  }

  // Trim transparent padding and save
  const trimmed = await sharp(outBuffer, {
    raw: { width: w, height: h, channels: 4 },
  })
    .trim({ threshold: 10 })
    .png({ quality: 100 })
    .toBuffer();

  const finalImage = sharp(trimmed);
  const finalMeta = await finalImage.metadata();
  console.log(`Trimmed size: ${finalMeta.width}x${finalMeta.height}`);

  await sharp(trimmed).toFile("public/theziessstore-logo.png");
  await sharp(trimmed).toFile("public/logo.png");
  console.log("✅ public/theziessstore-logo.png updated successfully!");
}

makeCleanLogo().catch(console.error);

