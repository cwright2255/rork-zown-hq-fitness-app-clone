// lib/tryOnSpike/formatReport.js
//
// The text the try-on runtime test shows and shares: every measurement, the target it is held to, and whether it is inside it.
import { TARGETS, decodedTextureMB } from './stats';
import { REAL_SHORTS_M } from './standInGarment';

const ok = (inside) => (inside ? 'ok' : 'OVER TARGET');
const upTo = (value, target) => (value == null ? 'no result' : ok(value <= target));
const atLeast = (value, target) => (value == null ? 'no result' : ok(value >= target));
const num = (x) => (x == null ? '-' : String(x));

/** report: { device: { os, version }, js: runJsBenchmarks result, gl: runGlTest result | { error } | null, body: { state, ms? } } -> an array of lines. */
export function formatReport(report) {
  const { device = {}, js, gl, body } = report;
  const lines = [];
  lines.push('TRY-ON RUNTIME TEST (stand-in garment, nothing fitted)');
  lines.push('Phone: ' + (device.os || '?') + ' ' + (device.version || '') + '   App: ' + (device.app || '?'));
  if (js) lines.push('Garment: ' + js.vertices + ' points, ' + js.triangles + ' triangles (the real shorts M: ' + REAL_SHORTS_M.vertices + ' points, ' + REAL_SHORTS_M.triangles + ' triangles)');
  lines.push('');

  if (js) {
    lines.push('BLEND TO A NEW BODY (no graphics)   target: 16 shape changes at most ' + TARGETS.blendMedianMs + ' ms');
    Object.keys(js.blend).forEach((count) => {
      const b = js.blend[count];
      lines.push('  ' + count + ' shape changes (' + b.megabytes + ' MB): median ' + b.median + ' ms, slow one in 20 ' + b.p95 + ' ms, worst ' + b.max + ' ms' + (count === '16' ? '   ' + upTo(b.median, TARGETS.blendMedianMs) : ''));
    });
    if (js.normals) lines.push('SURFACE DIRECTIONS: median ' + js.normals.median + ' ms, slow one in 20 ' + js.normals.p95 + ' ms   target at most ' + TARGETS.normalsMedianMs + ' ms   ' + upTo(js.normals.median, TARGETS.normalsMedianMs));
    if (js.pack && js.pack.skipped) {
      lines.push('PACK FROM STORAGE: skipped, ' + js.pack.skipped);
    } else if (js.pack) {
      lines.push('PACK FROM STORAGE (' + (Math.round(js.pack.bytes / 1e5) / 10) + ' MB): write ' + js.pack.writeMs + ' ms; read ' + js.pack.readMs + ' ms + make usable ' + js.pack.decodeMs + ' ms + check fingerprint ' + js.pack.hashMs + ' ms = ' + js.pack.loadMs + ' ms   target at most ' + TARGETS.packLoadMs + ' ms   ' + upTo(js.pack.loadMs, TARGETS.packLoadMs) + (js.pack.intact ? '' : '   READ BACK DIFFERENT FROM WHAT WAS SAVED'));
    }
    lines.push('');
  }

  if (body) lines.push('BODY SCAN IN THE SCENE: ' + body.state + (body.ms != null ? ' (' + body.ms + ' ms)' : ''));
  if (gl && gl.cancelled) {
    lines.push('GRAPHICS: stopped early (the screen was closed)');
  } else if (gl && gl.error) {
    lines.push('GRAPHICS: failed, ' + gl.error);
  } else if (gl) {
    lines.push('TWO 2048 x 2048 PICTURES: ' + gl.textures.firstMs + ' ms + ' + gl.textures.secondMs + ' ms = ' + gl.textures.totalMs + ' ms   target at most ' + TARGETS.textureLoadMs + ' ms   ' + upTo(gl.textures.totalMs, TARGETS.textureLoadMs));
    lines.push('  in the phone\'s memory once opened: about ' + gl.textures.decodedMB + ' MB (the real shorts\' 4096 x 4096 pair would be about ' + Math.round(decodedTextureMB(REAL_SHORTS_M.textureSize, REAL_SHORTS_M.textureSize) * REAL_SHORTS_M.textures) + ' MB)');
    lines.push('FIRST FRAME (includes the graphics chip\'s one-time set-up): ' + gl.firstFrameMs + ' ms   target at most ' + TARGETS.firstFrameMs + ' ms   ' + upTo(gl.firstFrameMs, TARGETS.firstFrameMs));
    if (gl.spin) {
      lines.push('TURNING (' + gl.spin.frames + ' frames): ' + num(gl.spin.fps) + ' frames a second   target at least ' + TARGETS.fpsMin + '   ' + atLeast(gl.spin.fps, TARGETS.fpsMin));
      lines.push('  time between frames: median ' + gl.spin.gapMedian + ' ms, slow one in 20 ' + gl.spin.gapP95 + ' ms (target at most ' + TARGETS.frameGapP95Ms + '), worst ' + gl.spin.gapMax + ' ms   ' + upTo(gl.spin.gapP95, TARGETS.frameGapP95Ms));
    } else {
      lines.push('TURNING: too few frames to measure');
    }
    if (gl.swaps) {
      lines.push('SWAP TO A NEW BODY, ' + gl.swaps.blend.n + ' times: blend median ' + gl.swaps.blend.median + ' ms, surface directions ' + gl.swaps.normals.median + ' ms, upload and draw ' + gl.swaps.draw.median + ' ms (worst ' + gl.swaps.draw.max + ' ms)');
    }
  }
  lines.push('');
  lines.push('Not measured here: memory in use (the phone does not let an app read it); whether a hold-out body drapes true (that is checked on a computer, not on the phone).');
  return lines;
}
