import React from 'react';
import { StyleProp, ViewStyle } from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';

// V54 (RAPPORT — "faire fonctionner les systèmes de vidéos"): expo-av is
// deprecated (no new versions for SDK 54+, fully removed in SDK 55) —
// expo-video is the current replacement. `useVideoPlayer` is a hook, so
// each feed item needs its own instance of this component rather than the
// parent list calling the hook once per row inside a .map()/renderItem,
// which would break React's rules of hooks.
//
// Starts muted (autoplay-with-sound in a scrolling feed is a bad surprise)
// with native controls so the person can unmute/pause/seek themselves.
export function VideoPlayer({
  uri,
  style,
  autoPlay = false,
  loop = true,
}: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  autoPlay?: boolean;
  loop?: boolean;
}) {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = loop;
    p.muted = true;
    if (autoPlay) p.play();
  });

  return (
    <VideoView
      style={style}
      player={player}
      allowsFullscreen
      allowsPictureInPicture
      nativeControls
    />
  );
}
