import { inflateSync } from 'node:zlib';

/**
 * Minimal text-layer reader for the PDFs Chromium (Skia) writes: uncompressed object dictionaries,
 * Flate content streams, Type0 Identity-H fonts with ToUnicode CMaps, and Form XObjects (Chromium puts
 * semi-transparent layers such as the stamp in one). Test helper only; not a general PDF parser.
 */

type Obj = { dict: string; streamAt: number | null; at: number };

function balancedDict(s: string, from: number): string {
  let depth = 0;
  for (let i = from; i < s.length - 1; i++) {
    const two = s.slice(i, i + 2);
    if (two === '<<') (depth++, i++);
    else if (two === '>>') {
      depth--;
      i++;
      if (depth === 0) return s.slice(from, i + 1);
    }
  }
  throw new Error('unbalanced dictionary');
}

function readObjects(s: string): Map<number, Obj> {
  const objs = new Map<number, Obj>();
  for (const m of s.matchAll(/(\d+)\s+0\s+obj\b\s*/g)) {
    const at = m.index! + m[0].length;
    if (!s.startsWith('<<', at)) {
      objs.set(Number(m[1]), { dict: '', streamAt: null, at });
      continue;
    }
    const dict = balancedDict(s, at);
    const after = /^\s*stream\r?\n/.exec(s.slice(at + dict.length, at + dict.length + 20));
    objs.set(Number(m[1]), { dict, streamAt: after ? at + dict.length + after[0].length : null, at });
  }
  return objs;
}

export function pdfPageTexts(pdf: Buffer): string[] {
  const s = pdf.toString('latin1');
  const objs = readObjects(s);
  const get = (n: number) => {
    const o = objs.get(n);
    if (!o) throw new Error(`missing object ${n}`);
    return o;
  };

  const stream = (n: number): string => {
    const o = get(n);
    if (o.streamAt === null) throw new Error(`object ${n} has no stream`);
    const len = /\/Length\s+(\d+)(\s+0\s+R)?/.exec(o.dict)!;
    const length = len[2] ? Number(/^\s*(\d+)/.exec(s.slice(get(Number(len[1])).at))![1]) : Number(len[1]);
    const raw = Buffer.from(s.slice(o.streamAt, o.streamAt + length), 'latin1');
    return (/\/FlateDecode/.test(o.dict) ? inflateSync(raw) : raw).toString('latin1');
  };

  const refs = (dict: string, key: string): Map<string, number> => {
    const m = new RegExp(`/${key}\\s*<<([^<>]*)>>`).exec(dict);
    return new Map([...(m?.[1] ?? '').matchAll(/\/([\w.+-]+)\s+(\d+)\s+0\s+R/g)].map((r) => [r[1]!, Number(r[2])]));
  };
  const resourcesOf = (dict: string) => {
    const ref = /\/Resources\s+(\d+)\s+0\s+R/.exec(dict);
    return ref ? get(Number(ref[1])).dict : dict;
  };

  const cmaps = new Map<number, Map<number, string>>();
  const toUnicode = (fontObj: number): Map<number, string> => {
    const cached = cmaps.get(fontObj);
    if (cached) return cached;
    const map = new Map<number, string>();
    const ref = /\/ToUnicode\s+(\d+)\s+0\s+R/.exec(get(fontObj).dict);
    if (ref) {
      const cm = stream(Number(ref[1]));
      const hex = (h: string) => String.fromCodePoint(...(h.match(/.{4}/g) ?? []).map((x) => parseInt(x, 16)));
      for (const b of cm.matchAll(/beginbfchar([\s\S]*?)endbfchar/g))
        for (const [, c, u] of b[1]!.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g)) map.set(parseInt(c!, 16), hex(u!));
      for (const b of cm.matchAll(/beginbfrange([\s\S]*?)endbfrange/g))
        for (const [, lo, hi, u] of b[1]!.matchAll(/<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g))
          for (let c = parseInt(lo!, 16), k = 0; c <= parseInt(hi!, 16); c++, k++) map.set(c, String.fromCodePoint(parseInt(u!, 16) + k));
    }
    cmaps.set(fontObj, map);
    return map;
  };

  // Text of a content stream with its resources; Form XObjects are read where they are drawn.
  const textOf = (content: string, resources: string, depth = 0): string => {
    if (depth > 8) return '';
    const fonts = refs(resources, 'Font');
    const xobjects = refs(resources, 'XObject');
    let font = new Map<number, string>();
    let out = '';
    const decode = (h: string) => (h.replace(/\s/g, '').match(/.{4}/g) ?? []).map((c) => font.get(parseInt(c, 16)) ?? '').join('');
    for (const m of content.matchAll(/\/([\w.+-]+)\s+[\d.]+\s+Tf|\[([^\]]*)\]\s*TJ|<([0-9A-Fa-f\s]*)>\s*Tj|\/([\w.+-]+)\s+Do\b|\bET\b/g)) {
      if (m[1]) font = fonts.has(m[1]) ? toUnicode(fonts.get(m[1])!) : new Map();
      else if (m[2] !== undefined) out += [...m[2].matchAll(/<([0-9A-Fa-f\s]*)>/g)].map((h) => decode(h[1]!)).join('');
      else if (m[3] !== undefined) out += decode(m[3]);
      else if (m[4] && xobjects.has(m[4])) {
        const n = xobjects.get(m[4])!;
        if (/\/Subtype\s*\/Form/.test(get(n).dict)) out += textOf(stream(n), resourcesOf(get(n).dict), depth + 1);
      } else out += ' ';
    }
    return out;
  };

  const pageObjs: number[] = [];
  const walk = (n: number) => {
    const d = get(n).dict;
    if (/\/Type\s*\/Pages\b/.test(d)) for (const k of /\/Kids\s*\[([^\]]*)\]/.exec(d)![1]!.matchAll(/(\d+)\s+0\s+R/g)) walk(Number(k[1]));
    else pageObjs.push(n);
  };
  const catalog = [...objs.values()].find((o) => /\/Type\s*\/Catalog\b/.test(o.dict))!;
  walk(Number(/\/Pages\s+(\d+)\s+0\s+R/.exec(catalog.dict)![1]));

  return pageObjs.map((n) => {
    const d = get(n).dict;
    const contents = /\/Contents\s*(\[[^\]]*\]|\d+\s+0\s+R)/.exec(d)![1]!;
    const streams = [...contents.matchAll(/(\d+)\s+0\s+R/g)].map((r) => stream(Number(r[1]))).join('\n');
    return textOf(streams, resourcesOf(d));
  });
}
