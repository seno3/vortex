import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

function ffmpegBin(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const bin = require('ffmpeg-static') as string;
    if (bin) return bin;
  } catch { /* fall through */ }
  return 'ffmpeg';
}

/**
 * Encode a sequence of JPEG buffers into an H.264 MP4.
 * Frames should be ordered as a smooth panoramic sweep (e.g. 0°→330°).
 */
export function encodeFramesToMp4(frames: Buffer[], fps = 8): Buffer {
  const bin = ffmpegBin();
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'vortex-sv-'));
  try {
    for (let i = 0; i < frames.length; i++) {
      fs.writeFileSync(path.join(tmpDir, `frame${String(i).padStart(4, '0')}.jpg`), frames[i]);
    }
    const out = path.join(tmpDir, 'pano.mp4');
    execFileSync(bin, [
      '-y',
      '-framerate', String(fps),
      '-i', path.join(tmpDir, 'frame%04d.jpg'),
      '-c:v', 'libx264',
      '-pix_fmt', 'yuv420p',
      '-preset', 'fast',
      '-crf', '22',
      out,
    ]);
    return fs.readFileSync(out);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
