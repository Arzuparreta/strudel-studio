/**
 * Single webaudio/soundMap: re-export from @strudel/web so @strudel/soundfonts
 * and the bridge use the same soundMap as the REPL (no "loaded more than once" / GM sounds not found).
 */
export {
  aliasBank,
  doughsamples,
  getADSRValues,
  getAudioContext,
  getAudioContextCurrentTime,
  getParamADSR,
  getPitchEnvelope,
  getVibratoOscillator,
  onceEnded,
  registerSound,
  releaseAudioNode,
  registerSynthSounds,
  registerZZFXSounds,
  samples,
  soundMap,
} from "@strudel/web";
