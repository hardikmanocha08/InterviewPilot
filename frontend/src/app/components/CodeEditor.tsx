'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

const LANGUAGES = [
  { id: 'javascript', label: 'JavaScript', ext: '.js' },
  { id: 'python', label: 'Python', ext: '.py' },
  { id: 'java', label: 'Java', ext: '.java' },
  { id: 'c', label: 'C', ext: '.c' },
  { id: 'cpp', label: 'C++', ext: '.cpp' },
];

const KEYWORDS: Record<string, string[]> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'switch', 'case', 'break', 'continue', 'do', 'in', 'of', 'yield'],
  typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'true', 'false', 'null', 'undefined', 'typeof', 'instanceof', 'switch', 'case', 'break', 'continue', 'do', 'in', 'of', 'yield', 'interface', 'type', 'enum', 'implements', 'extends', 'private', 'public', 'protected', 'readonly', 'keyof'],
  python: ['def', 'class', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'try', 'except', 'finally', 'raise', 'with', 'yield', 'lambda', 'True', 'False', 'None', 'and', 'or', 'not', 'in', 'is', 'pass', 'break', 'continue', 'self', 'async', 'await', 'global', 'nonlocal'],
  java: ['public', 'private', 'protected', 'static', 'final', 'abstract', 'class', 'interface', 'extends', 'implements', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'new', 'this', 'super', 'void', 'int', 'double', 'float', 'boolean', 'char', 'long', 'short', 'byte', 'String', 'true', 'false', 'null'],
  cpp: ['int', 'float', 'double', 'char', 'bool', 'void', 'string', 'vector', 'map', 'set', 'auto', 'const', 'static', 'class', 'struct', 'public', 'private', 'protected', 'virtual', 'override', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'throw', 'new', 'delete', 'nullptr', 'true', 'false', 'include', 'using', 'namespace', 'template', 'typename'],
  c: ['int', 'float', 'double', 'char', 'void', 'short', 'long', 'signed', 'unsigned', 'const', 'static', 'extern', 'auto', 'register', 'volatile', 'struct', 'union', 'enum', 'typedef', 'sizeof', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'default', 'goto', 'true', 'false', 'NULL', 'include', 'define', 'ifdef', 'ifndef', 'endif'],
  csharp: ['public', 'private', 'protected', 'static', 'void', 'class', 'interface', 'return', 'if', 'else', 'for', 'foreach', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'new', 'this', 'base', 'using', 'namespace', 'async', 'await', 'var', 'const', 'readonly', 'string', 'int', 'bool', 'double', 'float', 'decimal', 'true', 'false', 'null'],
  go: ['package', 'import', 'func', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'break', 'continue', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'select', 'var', 'const', 'true', 'false', 'nil', 'string', 'int', 'float64', 'bool', 'byte', 'error', 'make', 'append', 'len', 'cap', 'close'],
  rust: ['fn', 'let', 'mut', 'const', 'static', 'pub', 'priv', 'use', 'mod', 'struct', 'enum', 'impl', 'trait', 'type', 'where', 'return', 'if', 'else', 'for', 'while', 'loop', 'match', 'break', 'continue', 'self', 'Self', 'super', 'crate', 'true', 'false', 'Some', 'None', 'Ok', 'Err', 'String', 'Vec', 'i32', 'i64', 'u32', 'u64', 'f32', 'f64', 'bool', 'char', 'str', 'async', 'await', 'move', 'ref', 'in'],
};

function highlightCode(code: string, language: string): string {
  const keywords = KEYWORDS[language] || KEYWORDS.javascript;

  const tokenRegex = /(\/\/[^\n]*)|(\/\*[\s\S]*?\*\/)|(#.*$)|("""[\s\S]*?"""|'''[\s\S]*?'''|"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`)|(\b\d+\.?\d*\b)|(\b(?:[a-zA-Z_$][\w$]*)\b)/g;

  const result = code.replace(tokenRegex, (match, lineComment, blockComment, hashComment, stringLit, number, identifier) => {
    if (lineComment || blockComment || hashComment) {
      return `<span class="text-gray-500 italic">${match.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
    }
    if (stringLit) {
      return `<span class="text-green-400">${stringLit.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')}</span>`;
    }
    if (number) {
      return `<span class="text-orange-400">${number}</span>`;
    }
    if (identifier && keywords.includes(identifier)) {
      return `<span class="text-purple-400 font-semibold">${identifier}</span>`;
    }
    return match.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  });

  return result;
}

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  onLanguageChange?: (language: string) => void;
  readOnly?: boolean;
  placeholder?: string;
  onRun?: (code: string, language: string) => void;
  running?: boolean;
  output?: string;
  className?: string;
}

export default function CodeEditor({
  value,
  onChange,
  language = 'javascript',
  onLanguageChange,
  readOnly = false,
  placeholder,
  onRun,
  running = false,
  output,
  className = '',
}: CodeEditorProps) {
  const [lang, setLang] = useState(language);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const [lineCount, setLineCount] = useState(1);

  useEffect(() => {
    setLang(language);
  }, [language]);

  useEffect(() => {
    const lines = value.split('\n').length;
    setLineCount(lines);
  }, [value]);

  const handleScroll = useCallback(() => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      onChange(newValue);
      requestAnimationFrame(() => {
        target.selectionStart = target.selectionEnd = start + 2;
      });
    }
  }, [value, onChange]);

  const highlightedCode = highlightCode(value, lang);

  return (
    <div className={`flex flex-col h-full ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-surface border-b border-border px-3 py-2">
        <div className="flex items-center gap-2">
          {onLanguageChange && (
            <select
              value={lang}
              onChange={(e) => {
                setLang(e.target.value);
                onLanguageChange(e.target.value);
              }}
              className="bg-background border border-border rounded px-2 py-1 text-xs text-white focus:outline-none focus:border-primary"
            >
              {LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>{l.label}</option>
              ))}
            </select>
          )}
        </div>
        {onRun && (
          <button
            onClick={() => onRun(value, lang)}
            disabled={running}
            className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-xs px-3 py-1.5 rounded font-medium transition-colors flex items-center gap-1"
          >
            {running ? (
              <>
                <div className="w-3 h-3 border border-white border-t-transparent rounded-full animate-spin" />
                Running...
              </>
            ) : (
              <>▶ Run</>
            )}
          </button>
        )}
      </div>

      {/* Editor area */}
      <div className="flex-1 relative overflow-hidden bg-[#1e1e2e]">
        {/* Line numbers */}
        <div className="absolute left-0 top-0 bottom-0 w-10 bg-[#181825] border-r border-border/30 text-right pr-2 pt-3 text-xs text-gray-600 font-mono select-none overflow-hidden z-10">
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="leading-5">{i + 1}</div>
          ))}
        </div>

        {/* Syntax highlight layer (behind textarea) */}
        <pre
          ref={preRef}
          className="absolute inset-0 left-10 m-0 p-3 font-mono text-sm leading-5 whitespace-pre overflow-hidden pointer-events-none"
          aria-hidden="true"
          dangerouslySetInnerHTML={{ __html: highlightedCode + '\n' }}
        />

        {/* Textarea (transparent, on top) */}
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onScroll={handleScroll}
          onKeyDown={handleKeyDown}
          readOnly={readOnly}
          spellCheck={false}
          placeholder={placeholder || 'Write code here...'}
          className="absolute inset-0 left-10 w-[calc(100%-2.5rem)] h-full p-3 font-mono text-sm leading-5 bg-transparent text-transparent caret-white resize-none focus:outline-none selection:bg-primary/30 placeholder:text-gray-600"
          style={{ WebkitTextFillColor: 'transparent' }}
        />
      </div>

      {/* Output panel */}
      {output && (
        <div className="border-t border-border bg-[#11111b] px-3 py-2">
          <div className="text-xs text-gray-500 mb-1">Output</div>
          <pre className="font-mono text-xs text-green-400 whitespace-pre-wrap max-h-32 overflow-auto">{output}</pre>
        </div>
      )}
    </div>
  );
}
