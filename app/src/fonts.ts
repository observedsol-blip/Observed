/**
 * Font loading.
 *
 * IMPORTANT — Android rendering:
 * @expo-google-fonts/{literata,ibm-plex-sans,ibm-plex-mono} ship ONLY static,
 * per-weight TTF cuts (e.g. 400Regular/Literata_400Regular.ttf). None of the
 * three packages contains a variable cut (no *_Variable.ttf, no *_wght*.ttf) —
 * verified with `find node_modules/@expo-google-fonts -iname '*variable*'`.
 * Variable-font cuts have failed to render on Android in the past, so this is
 * the outcome we want; see app/README.md.
 *
 * We import the per-weight SUBPATH modules rather than the package index.
 * The index re-exports every cut (16 for Literata, 14 each for Plex Sans/Mono),
 * which would drag all of them into the bundle. Importing the subpaths keeps
 * exactly six TTFs in the APK.
 */
import { useFonts } from 'expo-font';
import { Literata_400Regular } from '@expo-google-fonts/literata/400Regular';
import { Literata_600SemiBold } from '@expo-google-fonts/literata/600SemiBold';
import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexMono_400Regular } from '@expo-google-fonts/ibm-plex-mono/400Regular';
import { IBMPlexMono_500Medium } from '@expo-google-fonts/ibm-plex-mono/500Medium';

export function useObservedFonts(): boolean {
  const [loaded] = useFonts({
    Literata_400Regular,
    Literata_600SemiBold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexMono_400Regular,
    IBMPlexMono_500Medium,
  });
  return loaded;
}
