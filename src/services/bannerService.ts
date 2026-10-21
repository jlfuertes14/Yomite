/**
 * Banner Service - Profile Banner Processing & Cloud Storage
 * Resizes banner images to a lightweight 1280px-wide JPG and stores them in
 * the public Supabase Storage bucket, then persists the URL in user metadata.
 */
import { Platform } from 'react-native';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import type { ImagePickerAsset } from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useUserStore } from '../store/userStore';

export async function processAndUploadBanner(
  userId: string,
  asset: ImagePickerAsset
): Promise<{ success: boolean; bannerUrl?: string; error?: string }> {
  if (!userId) {
    return { success: false, error: 'User not authenticated' };
  }

  try {
    const manipResult = await manipulateAsync(
      asset.uri,
      [{ resize: { width: 1280 } }],
      {
        compress: 0.78,
        format: SaveFormat.JPEG,
        base64: true,
      }
    );

    const fileName = `${userId}/banner_${Date.now()}.jpg`;

    let fileBody: any;
    if (Platform.OS === 'web') {
      const response = await fetch(manipResult.uri);
      fileBody = await response.blob();
    } else if (manipResult.base64) {
      const binaryString = atob(manipResult.base64);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      fileBody = bytes;
    } else {
      const response = await fetch(manipResult.uri);
      fileBody = await response.blob();
    }

    if (!fileBody) {
      return { success: false, error: 'Could not prepare the banner image.' };
    }

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from('avatars')
      .upload(fileName, fileBody, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadErr || !uploadData) {
      console.error('Banner storage upload failed:', uploadErr);
      return { success: false, error: uploadErr?.message || 'Could not upload the banner image.' };
    }

    const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName);
    const bannerUrl = publicData?.publicUrl;

    if (!bannerUrl) {
      return { success: false, error: 'No public banner URL was returned.' };
    }

    const { updateProfile } = useUserStore.getState();
    const { error: updateError } = await updateProfile({ banner_url: bannerUrl });

    if (updateError) {
      console.error('Failed to save banner URL in Supabase:', updateError);
      return { success: false, error: updateError.message || 'Failed to save banner.' };
    }

    return { success: true, bannerUrl };
  } catch (err: any) {
    console.error('Error processing banner image:', err);
    return { success: false, error: err?.message || 'Error processing banner image.' };
  }
}
