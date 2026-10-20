export type Token = { text: string; kind: 'plain' | 'keyword' | 'string' | 'number' | 'comment' | 'anchor' | 'def' | 'builtin' }

const KEYWORDS = new Set([
  'def', 'return', 'if', 'elif', 'else', 'for', 'while', 'in', 'not', 'and', 'or', 'is', 'import', 'from', 'as',
  'with', 'try', 'except', 'finally', 'raise', 'class', 'lambda', 'yield', 'pass', 'break', 'continue', 'None',
  'True', 'False', 'const', 'let', 'function', 'export', 'type', 'new', 'await', 'async', 'null', 'undefined',
])
const BUILTINS = new Set(['len', 'range', 'dict', 'list', 'set', 'tuple', 'int', 'float', 'str', 'sum', 'min', 'max',
  'sorted', 'zip', 'enumerate', 'print', 'np', 'pd', 'sparse'])

// Small on purpose: enough to separate keywords, strings, numbers and comments in a read-only drawer.
const PATTERN = /(#.*$|\/\/.*$)|("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`[^`]*`)|\b(\d+(?:[._]\d+)*(?:\.\d+)?)\b|([A-Za-z_][A-Za-z0-9_]*)/g

export function highlightLine(line: string): Token[] {
  const out: Token[] = []
  let last = 0
  let afterDef = false
  for (const m of line.matchAll(PATTERN)) {
    if (m.index > last) out.push({ text: line.slice(last, m.index), kind: 'plain' })
    const [text, comment, string, number, word] = m
    if (comment) out.push({ text, kind: /\[[a-z-]+\]/.test(comment) ? 'anchor' : 'comment' })
    else if (string) out.push({ text, kind: 'string' })
    else if (number) out.push({ text, kind: 'number' })
    else if (word && KEYWORDS.has(word)) out.push({ text, kind: 'keyword' })
    else if (word && afterDef) out.push({ text, kind: 'def' })
    else if (word && BUILTINS.has(word)) out.push({ text, kind: 'builtin' })
    else out.push({ text, kind: 'plain' })
    afterDef = word === 'def' || word === 'function' || word === 'class'
    last = m.index + text.length
  }
  if (last < line.length) out.push({ text: line.slice(last), kind: 'plain' })
  return out
}
