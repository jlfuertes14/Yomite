import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { useReaderStore } from '../store/readerStore';

/** Fire subtle feedback only when the app-wide preference allows it. */
export function triggerHaptic(
  style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light
): void {
  if (Platform.OS === 'web' || !useReaderStore.getState().hapticsEnabled) return;
  void Haptics.impactAsync(style);
}
