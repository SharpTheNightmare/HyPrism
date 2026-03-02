import { useState, useEffect } from 'react';
import { on } from '@/lib/ipc';

export function useLauncherUpdate() {
  const [updateAsset, setUpdateAsset] = useState<any>(null);

  useEffect(() => {
    return on('hyprism:update:available', (asset: any) => {
      setUpdateAsset(asset);
    });
  }, []);

  return { updateAsset };
}
