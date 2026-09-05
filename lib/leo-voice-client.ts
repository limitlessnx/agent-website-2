export type LeoExtendedMediaTrackConstraints = MediaTrackConstraints & {
  voiceIsolation?: boolean;
};

type LeoExtendedSupportedConstraints = MediaTrackSupportedConstraints & {
  voiceIsolation?: boolean;
};

export function getLeoMicrophoneConstraints(): LeoExtendedMediaTrackConstraints {
  const supported = navigator.mediaDevices.getSupportedConstraints() as LeoExtendedSupportedConstraints;
  const constraints: LeoExtendedMediaTrackConstraints = {};

  if (supported.echoCancellation) constraints.echoCancellation = true;
  if (supported.noiseSuppression) constraints.noiseSuppression = true;
  if (supported.autoGainControl) constraints.autoGainControl = true;
  if (supported.channelCount) constraints.channelCount = 1;

  // Safari and other WebKit-based browsers may expose Voice Isolation as an
  // extended MediaTrack constraint. Feature-detect it so unsupported browsers
  // simply fall back to WebRTC echo cancellation and noise suppression.
  if (supported.voiceIsolation) constraints.voiceIsolation = true;

  return constraints;
}
