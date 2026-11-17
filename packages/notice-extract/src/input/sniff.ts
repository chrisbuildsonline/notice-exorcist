export type InputType = 'png' | 'jpeg' | 'pdf';

const MAGIC: [InputType, number[]][] = [
  ['png', [0x89, 0x50, 0x4e, 0x47]],
  ['jpeg', [0xff, 0xd8, 0xff]],
  ['pdf', [0x25, 0x50, 0x44, 0x46, 0x2d]], // %PDF-
];

/** The input type from its first bytes; null for anything else. File names and caller mime types are not used. */
export function sniff(bytes: Uint8Array): InputType | null {
  for (const [type, magic] of MAGIC) if (magic.every((b, i) => bytes[i] === b)) return type;
  return null;
}
