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
  if (supported.voiceIsolation) constraints.voiceIsolation = true;

  return constraints;
}
