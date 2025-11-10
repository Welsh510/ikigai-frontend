// database/routes/utils/audioConverter.js
// -------------------------------------------------------------
// Audio conversion + probing for WhatsApp voice notes.
// Converts to OGG/Opus and verifies codec/channels/samplerate/duration.
// -------------------------------------------------------------

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ffmpeg = require('fluent-ffmpeg');

let ffmpegPath, ffprobePath;
try { ffmpegPath = require('ffmpeg-static'); } catch (_) {}
try { ffprobePath = require('@ffprobe-installer/ffprobe').path; } catch (_) {}

if (ffmpegPath) ffmpeg.setFfmpegPath(ffmpegPath);
if (ffprobePath) ffmpeg.setFfprobePath(ffprobePath);

function ensureTempDir() {
  const tempDir = path.join(__dirname, '../../temp');
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
  return tempDir;
}

/**
 * Probe an on-disk audio file with ffprobe and return key audio stats.
 */
function ffprobeFile(filePath) {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) return reject(err);
      const audio = (data.streams || []).find(s => s.codec_type === 'audio') || {};
      const fmt = data.format || {};
      resolve({
        codec_name: audio.codec_name || '',
        sample_rate: audio.sample_rate ? parseInt(audio.sample_rate, 10) : 0,
        channels: audio.channels || 0,
        duration: (typeof fmt.duration === 'number') ? fmt.duration
                  : (fmt.duration ? parseFloat(fmt.duration) : 0),
        format_name: fmt.format_name || ''
      });
    });
  });
}

/**
 * Convert arbitrary audio input buffer to OGG/Opus mono 16 kHz.
 */
async function convertToWhatsAppVoice(inputBuffer, originalMimeType) {
  return new Promise((resolve, reject) => {
    const tempDir = ensureTempDir();
    const id = crypto.randomBytes(16).toString('hex');

    const inputPath = path.join(tempDir, `in_${id}.bin`);
    const outputPath = path.join(tempDir, `out_${id}.ogg`);

    try { fs.writeFileSync(inputPath, inputBuffer); }
    catch (e) { return reject(new Error(`[audioConverter] write temp failed: ${e.message}`)); }

    ffmpeg(inputPath)
      .noVideo()
      .audioCodec('libopus')
      .audioChannels(1)
      .audioFrequency(16000)
      .audioBitrate('24k')
      .format('ogg')
      .outputOptions([
        '-application', 'voip',
        '-vbr', 'on',
        '-compression_level', '10'
      ])
      .on('error', (err) => {
        try { fs.existsSync(inputPath) && fs.unlinkSync(inputPath); } catch {}
        try { fs.existsSync(outputPath) && fs.unlinkSync(outputPath); } catch {}
        reject(err);
      })
      .on('end', () => {
        try {
          const buf = fs.readFileSync(outputPath);
          try { fs.unlinkSync(inputPath); } catch {}
          try { fs.unlinkSync(outputPath); } catch {}
          resolve(buf);
        } catch (e) { reject(e); }
      })
      .save(outputPath);
  });
}

/**
 * Analyze a buffer (already converted or original) to decide whether it is safe
 * to mark as a WA "voice" message.
 */
async function analyzeForVoiceEligibility(buffer) {
  const tempDir = ensureTempDir();
  const id = crypto.randomBytes(16).toString('hex');
  const tmpPath = path.join(tempDir, `probe_${id}.ogg`);

  // Write then probe
  fs.writeFileSync(tmpPath, buffer);
  try {
    const info = await ffprobeFile(tmpPath);
    // Accept ogg/opus mono with accepted sample rates and duration ≥ 1.0s
    const ok =
      (info.codec_name === 'opus') &&
      (info.channels === 1) &&
      ([16000, 24000, 48000].includes(info.sample_rate)) &&
      (info.duration >= 1.0);

    return { ok, info };
  } finally {
    try { fs.unlinkSync(tmpPath); } catch {}
  }
}

module.exports = {
  convertToWhatsAppVoice,
  analyzeForVoiceEligibility
};
