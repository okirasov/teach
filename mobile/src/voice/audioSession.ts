import { Platform } from 'react-native';

/**
 * Аудиосессия разговора с бадди (iOS). По умолчанию приложение живёт в категории soloAmbient,
 * которую глушит переключатель «Без звука»: озвучка не слышна из динамика. На время разговора
 * ставим playAndRecord с выводом на громкий динамик — она не подчиняется переключателю и
 * позволяет записывать и говорить в одной сессии (перебивание). Web/Android: ничего не делаем.
 */
type AudioModule = Pick<typeof import('expo-speech-recognition').ExpoSpeechRecognitionModule, 'setCategoryIOS' | 'setAudioSessionActiveIOS'>;

function moduleOrNull(): AudioModule | null {
  if (Platform.OS !== 'ios') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return (require('expo-speech-recognition') as typeof import('expo-speech-recognition')).ExpoSpeechRecognitionModule;
  } catch {
    return null;
  }
}

export function activateTalkAudio(): void {
  const m = moduleOrNull();
  if (!m) return;
  try {
    m.setCategoryIOS({ category: 'playAndRecord', categoryOptions: ['defaultToSpeaker', 'allowBluetooth'], mode: 'default' });
    m.setAudioSessionActiveIOS(true);
  } catch {
    // Голос никогда не блокирует: без сессии озвучка идёт как раньше.
  }
}

export function deactivateTalkAudio(): void {
  const m = moduleOrNull();
  if (!m) return;
  try {
    m.setAudioSessionActiveIOS(false, { notifyOthersOnDeactivation: true });
  } catch {
    // см. выше
  }
}
