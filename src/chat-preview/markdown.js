import MarkdownIt from 'markdown-it';

const parser = new MarkdownIt({ html: false, linkify: false, typographer: false });
const tags = new Set(['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'em', 'strong', 's', 'ol', 'ul', 'li',
  'blockquote', 'table', 'thead', 'tbody', 'tr', 'th', 'td']);

// Map only semantic text elements. File-authored attributes, navigation and assets never reach the DOM.
export function markdownNodes(h, text) {
  function render(tokens) {
    const frame = [{ children: [] }];
    function add(node) { frame.at(-1).children.push(node); }
    for (const [index, token] of tokens.entries()) {
      if (token.nesting === 1) {
        frame.push({ tag: tags.has(token.tag) && !token.hidden ? token.tag : null, children: [], key: index });
      } else if (token.nesting === -1) {
        const group = frame.pop();
        if (group.tag) add(h(group.tag, { key: group.key }, ...group.children));
        else for (const item of group.children) add(item);
      } else if (token.type === 'inline') {
        // Wrap each nested rendering list in its own keyed group.
        add(h('span', { key: index, className: 'dcp-md-inline' }, ...render(token.children ?? [])));
      } else if (token.type === 'code_inline') add(h('code', { key: index }, token.content));
      else if (token.type === 'fence' || token.type === 'code_block') add(h('pre', { key: index }, h('code', null, token.content)));
      else if (token.type === 'softbreak') add('\n');
      else if (token.type === 'hardbreak') add(h('br', { key: index }));
      else if (token.type === 'hr') add(h('hr', { key: index }));
      else if (token.type === 'text' || token.type === 'image') add(token.content);
    }
    return frame[0].children;
  }
  return render(parser.parse(text, {}));
}
