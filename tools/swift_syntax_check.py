import sys, glob, tree_sitter_swift as tss
from tree_sitter import Language, Parser
lang = Language(tss.language()); parser = Parser(lang)
bad = 0
for f in sorted(glob.glob(sys.argv[1] + '/**/*.swift', recursive=True)):
    src = open(f, 'rb').read(); tree = parser.parse(src)
    errs = []
    def walk(n):
        if n.type == 'ERROR' or n.is_missing: errs.append(n)
        for c in n.children: walk(c)
    walk(tree.root_node)
    if errs:
        bad += 1
        for e in errs[:3]:
            line = src.splitlines()[e.start_point[0]].decode()
            print(f"{f}:{e.start_point[0]+1}: {'MISSING' if e.is_missing else 'ERROR'} {e.type}: {line.strip()[:110]}")
print("files with syntax issues:", bad)
