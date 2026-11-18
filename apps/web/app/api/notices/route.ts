import { cappedRequest, fileNotice } from '../../../lib/intake';
import { checkUpload } from '../../../lib/upload-check';
import { NO_FILE, OVERSIZE } from '../../../lib/upload-messages';

export const dynamic = 'force-dynamic';

/** Upload one notice (field `file`): PDF, PNG or JPEG up to 10 MB. Nothing is stored or logged on rejection. */
export async function POST(request: Request) {
  const req = await cappedRequest(request);
  if (!req) return Response.json({ error: OVERSIZE }, { status: 413 });
  let file: FormDataEntryValue | null = null;
  try {
    file = (await req.formData()).get('file');
  } catch {
    // not multipart: falls through to the 400 below
  }
  if (!(file instanceof File)) return Response.json({ error: NO_FILE }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkUpload(bytes);
  if (!checked.ok) return Response.json({ error: checked.error, code: checked.code }, { status: checked.status });
  const { id } = fileNotice({ bytes, filename: file.name || 'notice', source: 'upload' });
  return Response.json({ id }, { status: 201 });
}
