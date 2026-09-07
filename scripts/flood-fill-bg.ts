import sharp from "sharp";

async function floodFillCutout() {
  const inputPath =
    "C:/Users/SokPhal/.gemini/antigravity/brain/4f674d03-5663-4b41-8a18-dcbf0ecab2d2/.user_uploaded/media_1788761604378.jpg";

  const original = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data: raw, info } = original;
  const w = info.width;
  const h = info.height;

  // 1. Mark letter pixels in the text region
  const isLetter = new Uint8Array(w * h);
  for (let y = 510; y < Math.min(h, 715); y++) {
    for (let x = 70; x < Math.min(w, 770); x++) {
      const idx = (y * w + x) * 4;
      const r = raw[idx], g = raw[idx + 1], b = raw[idx + 2];
      const max = Math.max(r, g, b);
      // Letter highlight / chrome silver / purple inner shadow
      if (max > 80 && (Math.abs(r - g) < 35 || (r > 70 && b > 80))) {
        isLetter[y * w + x] = 1;
      }
    }
  }

  // 2. Dilate letters by 7px to preserve the drop shadow & outline of the text
  const textShield = new Uint8Array(w * h);
  const dilateRadius = 7;
  for (let y = 510; y < Math.min(h, 715); y++) {
    for (let x = 60; x < Math.min(w, 780); x++) {
      if (!isLetter[y * w + x]) continue;
      for (let dy = -dilateRadius; dy <= dilateRadius; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= h) continue;
        for (let dx = -dilateRadius; dx <= dilateRadius; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= w) continue;
          if (dx * dx + dy * dy <= dilateRadius * dilateRadius) {
            textShield[ny * w + nx] = 1;
          }
        }
      }
    }
  }

  // Pixels in the character body, text, or vibrant wings are NEVER background.
  function isGuaranteedForeground(x: number, y: number, r: number, g: number, b: number) {
    // 1. Text banner outline (dilated letters)
    if (textShield[y * w + x]) {
      return true;
    }

    // 2. Character head, hair, face, mask (x: 215..610, y: 65..370)
    if (x >= 215 && x <= 610 && y >= 65 && y <= 370) {
      return true;
    }

    // 3. Character body, ninja clothes, arms (x: 280..545, y: 370..540)
    if (x >= 280 && x <= 545 && y >= 370 && y <= 540) {
      return true;
    }

    // 4. Purple wings / flames / panther heads
    if ((r > 60 && b > 70 && (r + b) > 1.7 * g + 15) || (r > 110 && b > 120 && g < 110)) {
      return true;
    }

    // 5. Any bright glow, stars, or edge details
    if ((r + g + b) / 3 > 75) {
      return true;
    }

    return false;
  }

  function isBg(x: number, y: number) {
    const idx = (y * w + x) * 4;
    const r = raw[idx];
    const g = raw[idx + 1];
    const b = raw[idx + 2];

    if (isGuaranteedForeground(x, y, r, g, b)) {
      return false;
    }

    // Outside the main logo emblem (top sky, bottom floor, left/right margins)
    if (y < 45 || y > 700 || x < 15 || x > 815) {
      return true;
    }

    // Sky directly above character hair (between left & right wings)
    if (y < 70 && x >= 210 && x <= 610) {
      return true;
    }

    const max = Math.max(r, g, b);
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;

    // Dark background or noise
    if (max < 52) return true;
    if (brightness < 45) return true;

    // Faint dark purple background aura outside the wings
    if (max < 85 && g < 45 && (r + g + b) / 3 < 58) return true;

    return false;
  }

  // Alpha array
  const alpha = new Uint8Array(w * h);
  alpha.fill(255); // Default: keep foreground

  const visited = new Uint8Array(w * h);
  const queueX = new Int32Array(w * h);
  const queueY = new Int32Array(w * h);
  let qHead = 0;
  let qTail = 0;

  function push(x: number, y: number) {
    const idx = y * w + x;
    if (!visited[idx]) {
      visited[idx] = 1;
      queueX[qTail] = x;
      queueY[qTail] = y;
      qTail++;
    }
  }

  // Seed with all border pixels
  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 0; y < h; y++) {
    push(0, y);
    push(w - 1, y);
  }

  // Also seed top/bottom margin pixels
  for (let x = 0; x < w; x += 5) {
    for (let y = 0; y < 45; y += 5) push(x, y);
    for (let y = 705; y < h; y += 5) push(x, y);
  }
  for (let x = 210; x <= 610; x += 5) {
    for (let y = 0; y < 70; y += 5) push(x, y);
  }

  let erasedCount = 0;
  while (qHead < qTail) {
    const x = queueX[qHead];
    const y = queueY[qHead];
    qHead++;

    if (isBg(x, y)) {
      alpha[y * w + x] = 0; // Mark background as transparent
      erasedCount++;

      // Expand to 4 neighbors
      if (x + 1 < w) push(x + 1, y);
      if (x - 1 >= 0) push(x - 1, y);
      if (y + 1 < h) push(x, y + 1);
      if (y - 1 >= 0) push(x, y - 1);
    }
  }
  console.log(`Erased background pixels: ${erasedCount} out of ${w * h}`);

  // Remove small disconnected speckles / dust (< 1500 pixels)
  const compVisited = new Uint8Array(w * h);
  let removedSpecks = 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      if (compVisited[idx] || alpha[idx] === 0) continue;

      const compIndices: number[] = [];
      const qx = [x];
      const qy = [y];
      compVisited[idx] = 1;
      let head = 0;
      while (head < qx.length) {
        const cx = qx[head];
        const cy = qy[head];
        head++;
        compIndices.push(cy * w + cx);

        const neighbors = [
          [cx + 1, cy],
          [cx - 1, cy],
          [cx, cy + 1],
          [cx, cy - 1],
        ];
        for (const [nx, ny] of neighbors) {
          if (nx >= 0 && nx < w && ny >= 0 && ny < h) {
            const nidx = ny * w + nx;
            if (!compVisited[nidx] && alpha[nidx] > 0) {
              compVisited[nidx] = 1;
              qx.push(nx);
              qy.push(ny);
            }
          }
        }
      }

      // If component is small (isolated specks/dust), erase it
      if (compIndices.length < 1500) {
        for (const p of compIndices) {
          alpha[p] = 0;
          removedSpecks++;
        }
      }
    }
  }
  console.log(`Removed ${removedSpecks} stray speckle pixels from background.`);

  // Second pass: feather the transition for smooth anti-aliased edges
  const smoothAlpha = new Uint8Array(alpha);
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const idx = y * w + x;
      if (alpha[idx] === 0) continue; // Already transparent

      // If it's in guaranteed foreground, keep it 100% solid!
      const pIdx = idx * 4;
      const r = raw[pIdx];
      const g = raw[pIdx + 1];
      const b = raw[pIdx + 2];

      if (isGuaranteedForeground(x, y, r, g, b)) {
        smoothAlpha[idx] = 255;
        continue;
      }

      // Check if neighboring transparent pixel
      let zeroCount = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (alpha[(y + dy) * w + (x + dx)] === 0) {
            zeroCount++;
          }
        }
      }

      if (zeroCount > 0) {
        const max = Math.max(r, g, b);
        const feather = Math.min(255, Math.max(0, Math.round((max / 135) * 255)));
        smoothAlpha[idx] = feather > 25 ? feather : 0;
      }
    }
  }

  // Apply smooth alpha to raw buffer
  const out = Buffer.from(raw);
  for (let i = 0; i < w * h; i++) {
    out[i * 4 + 3] = smoothAlpha[i];
  }

  // Trim fully transparent borders and save
  const finalImage = sharp(out, {
    raw: { width: w, height: h, channels: 4 },
  }).trim({ threshold: 5 });

  const finalBuffer = await finalImage.png({ quality: 100, compressionLevel: 9 }).toBuffer();
  const finalMeta = await sharp(finalBuffer).metadata();
  console.log(`Final Clean Cutout dimensions: ${finalMeta.width}x${finalMeta.height}`);

  await sharp(finalBuffer).toFile("public/theziessstore-logo.png");
  await sharp(finalBuffer).toFile("public/logo.png");
  console.log("✅ public/theziessstore-logo.png and public/logo.png successfully created!");
}

floodFillCutout().catch(console.error);
