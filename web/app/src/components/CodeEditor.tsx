// CodeMirror 6 editor with PHREEQC highlighting and completion of keywords and database names.
import { useEffect, useRef } from 'react';
import { EditorState, Compartment } from '@codemirror/state';
import { EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter, drawSelection } from '@codemirror/view';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { StreamLanguage, syntaxHighlighting, HighlightStyle, bracketMatching } from '@codemirror/language';
import { autocompletion, type CompletionContext } from '@codemirror/autocomplete';
import { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
import { tags } from '@lezer/highlight';
import { KEYWORD_ALIASES, ALL_KEYWORDS } from '../lib/keywords';

const phreeqcLang = StreamLanguage.define<{ inBasic: boolean }>({
  name: 'phreeqc',
  startState: () => ({ inBasic: false }),
  token(stream, state) {
    if (stream.sol()) {
      stream.eatSpace();
      const w = stream.match(/^[A-Za-z_]+/, false) as RegExpMatchArray | null;
      if (w && KEYWORD_ALIASES.has(w[0].toLowerCase()) && !state.inBasic) { stream.match(/^[A-Za-z_]+/); return 'keyword'; }
      if (stream.match(/^-start\b/i)) { state.inBasic = true; return 'meta'; }
      if (stream.match(/^-end\b/i)) { state.inBasic = false; return 'meta'; }
      if (w && /^end$/i.test(w[0])) { state.inBasic = false; stream.match(/^[A-Za-z_]+/); return 'keyword'; }
    }
    if (stream.eatSpace()) return null;
    const ch = stream.peek();
    if (ch === '#') { stream.skipToEnd(); return 'comment'; }
    if (ch === '"') { stream.next(); while (!stream.eol() && stream.next() !== '"') { /* string */ } return 'string'; }
    if (stream.match(/^-?\d+(\.\d*)?([eE][+-]?\d+)?\b/) || stream.match(/^-?\.\d+([eE][+-]?\d+)?/)) return 'number';
    if (stream.match(/^-[A-Za-z_]+/)) return 'propertyName';
    if (stream.match(/^[A-Z][a-z]?(\([+-]?\d+\))?(?![A-Za-z])/)) return 'variableName';
    stream.next();
    return null;
  },
});

const highlight = HighlightStyle.define([
  { tag: tags.keyword, color: 'var(--code-kw)', fontWeight: '600' },
  { tag: tags.comment, color: 'var(--code-cm)', fontStyle: 'italic' },
  { tag: tags.number, color: 'var(--code-num)' },
  { tag: tags.string, color: 'var(--code-num)' },
  { tag: tags.propertyName, color: 'var(--accent)' },
  { tag: tags.meta, color: 'var(--accent)', fontWeight: '600' },
  { tag: tags.variableName, color: 'var(--code-el)' },
]);

const theme = EditorView.theme({
  '&': { fontSize: '13px', backgroundColor: 'var(--surface)', color: 'var(--ink)', height: '100%' },
  '.cm-content': { fontFamily: 'var(--f-mono)', caretColor: 'var(--ink)' },
  '.cm-gutters': { backgroundColor: 'var(--surface)', color: 'var(--muted)', border: 'none' },
  '.cm-activeLine': { backgroundColor: 'var(--sunk)' },
  '.cm-activeLineGutter': { backgroundColor: 'var(--sunk)' },
  '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': { backgroundColor: 'var(--accent-soft) !important' },
  '.cm-tooltip': { backgroundColor: 'var(--surface)', border: '1px solid var(--line)', color: 'var(--ink)' },
  '.cm-tooltip-autocomplete ul li[aria-selected]': { backgroundColor: 'var(--accent-soft)', color: 'var(--ink)' },
  '.cm-scroller': { overflow: 'auto' },
});

interface Props { value: string; onChange: (v: string) => void; names: string[]; onRun?: () => void; jumpTo?: { line: number; n: number } | null; insert?: { text: string; n: number } | null }

export function CodeEditor({ value, onChange, names, onRun, jumpTo, insert }: Props) {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const namesRef = useRef(names);
  namesRef.current = names;
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onRunRef = useRef(onRun);
  onRunRef.current = onRun;
  const comp = useRef(new Compartment());

  useEffect(() => {
    const complete = (ctx: CompletionContext) => {
      const w = ctx.matchBefore(/[A-Za-z_()+\-0-9]*$/);
      if (!w || (w.from === w.to && !ctx.explicit)) return null;
      const lineStart = ctx.state.doc.lineAt(ctx.pos).from;
      const atStart = ctx.state.sliceDoc(lineStart, w.from).trim() === '';
      const kws = atStart ? ALL_KEYWORDS.map(k => ({ label: k.name, type: 'keyword', detail: k.desc, boost: 2 })) : [];
      const ns = namesRef.current.map(n => ({ label: n, type: 'variable' }));
      return { from: w.from, options: [...kws, ...ns], validFor: /^[A-Za-z_()+\-0-9]*$/ };
    };
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: value,
        extensions: [
          lineNumbers(), highlightActiveLine(), highlightActiveLineGutter(), drawSelection(), history(), bracketMatching(), highlightSelectionMatches(),
          comp.current.of([phreeqcLang, syntaxHighlighting(highlight)]), theme,
          autocompletion({ override: [complete], activateOnTyping: true }),
          keymap.of([{ key: 'Mod-Enter', run: () => { onRunRef.current?.(); return true; } }, indentWithTab, ...defaultKeymap, ...historyKeymap, ...searchKeymap]),
          EditorView.updateListener.of(u => { if (u.docChanged) onChangeRef.current(u.state.doc.toString()); }),
          EditorView.lineWrapping,
        ],
      }),
    });
    view.current = v;
    return () => v.destroy();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // external changes (open file, builder edits)
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== value) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: value } });
  }, [value]);

  useEffect(() => {
    const v = view.current;
    if (!v || !jumpTo) return;
    const line = v.state.doc.line(Math.min(Math.max(1, jumpTo.line), v.state.doc.lines));
    v.dispatch({ selection: { anchor: line.from }, scrollIntoView: true });
    v.focus();
  }, [jumpTo]);

  useEffect(() => {
    const v = view.current;
    if (!v || !insert) return;
    const pos = v.state.selection.main.head;
    const line = v.state.doc.lineAt(pos);
    const at = line.text.trim() ? line.to : line.from;
    const text = (line.text.trim() ? '\n' : '') + insert.text.replace(/\n$/, '') + '\n';
    v.dispatch({ changes: { from: at, insert: text }, selection: { anchor: at + text.length }, scrollIntoView: true });
    v.focus();
  }, [insert]);

  return <div ref={host} className="cm-host" />;
}
