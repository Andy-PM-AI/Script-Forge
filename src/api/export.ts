const BASE_URL = '/api/v1';

export type ExportFormat = 'pdf' | 'word';
export type ExportScope = 'all' | 'episode';

export async function exportFile(
  projectId: string,
  format: ExportFormat,
  scope: ExportScope = 'all',
  episodeNumber?: number,
): Promise<{ blob: Blob; filename: string }> {
  const res = await fetch(`${BASE_URL}/projects/${projectId}/export/${format}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ scope, episode_number: episodeNumber ?? null }),
  });

  if (!res.ok) {
    let message = `导出失败 (${res.status})`;
    try {
      const body = await res.json();
      if (body && typeof body.message === 'string') message = body.message;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') ?? '';
  const match = /filename\*=UTF-8''([^;]+)/.exec(disposition);
  const filename = match ? decodeURIComponent(match[1]) : `export.${format === 'pdf' ? 'pdf' : 'docx'}`;
  return { blob, filename };
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
