import React, { useEffect, useState } from 'react';
import { Text, TextStyle } from 'react-native';
import { colors, fonts } from '../theme';

// V54: shared by MissionsScreen and MissionDetailsScreen for the mission
// offer's 5-minute window ("Une minuterie visible doit apparaître... Mission
// disponible — 04:59 restantes"). onExpire fires once, exactly when the
// countdown hits zero, so the screen can refresh (the backend sweep — see
// missionScheduler.js — reassigns independently either way; this is purely
// so the UI doesn't keep showing an offer that's actually already gone).
export function CountdownTimer({ expiresAt, style, onExpire }: { expiresAt: string; style?: TextStyle; onExpire?: () => void }) {
  const [remainingMs, setRemainingMs] = useState(() => new Date(expiresAt).getTime() - Date.now());

  useEffect(() => {
    const id = setInterval(() => {
      const next = new Date(expiresAt).getTime() - Date.now();
      setRemainingMs(next);
      if (next <= 0) { clearInterval(id); onExpire?.(); }
    }, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);

  const totalSeconds = Math.max(0, Math.floor(remainingMs / 1000));
  const mm = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const ss = String(totalSeconds % 60).padStart(2, '0');

  return (
    <Text style={[{ fontFamily: fonts.brandSemibold, color: totalSeconds <= 60 ? colors.red : colors.gold }, style]}>
      {totalSeconds > 0 ? `${mm}:${ss} restantes` : 'Expirée'}
    </Text>
  );
}
