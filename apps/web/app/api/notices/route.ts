import { checkFile, fileNotice } from '../../../lib/intake';

export const dynamic = 'force-dynamic';

/** Upload one notice (field `file`): PDF, PNG or JPEG up to 10 MB. Nothing is stored on rejection. */
export async function POST(req: Request) {
  let file: FormDataEntryValue | null = null;
  try {
    file = (await req.formData()).get('file');
  } catch {
    // not multipart: falls through to the 400 below
  }
  if (!(file instanceof File)) return Response.json({ error: 'Choose a file to upload.' }, { status: 400 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const checked = checkFile(bytes);
  if (!checked.ok) return Response.json({ error: checked.error }, { status: checked.status });
  const { id } = fileNotice({ bytes, filename: file.name || 'notice', source: 'upload' });
  return Response.json({ id }, { status: 201 });
}
