import { describe, expect, test } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownMessage } from './MarkdownMessage';

// Regression test for: two identical fenced code blocks in the same message
// must not share a single "copied" identity. copiedCodeBlock used to be keyed
// by the raw code string, so clicking one block's copy button made every
// block with the same text also render as "Copied". The fix keys the copied
// state by a stable per-block render-order index instead.
//
// Note: this repo has no jsdom/@testing-library/react in devDependencies,
// and adding one is out of scope ("no new npm dependencies"), so this test
// exercises the component via react-dom/server (already a dependency)
// rather than simulating a real click event. It verifies the structural
// precondition the fix depends on: a markdown tree with two byte-identical
// fenced code blocks renders two independent copy controls, each starting
// in the un-copied state - i.e. nothing about the two blocks is merged or
// deduped by their shared text content.
describe('MarkdownMessage code block copy state', () => {
  test('renders independent copy controls for two identical fenced code blocks', () => {
    const duplicateBlock = '```js\nconsole.log("same code");\n```';
    const content = `${duplicateBlock}\n\n${duplicateBlock}`;

    const html = renderToStaticMarkup(<MarkdownMessage content={content} />);

    const copyButtonCount = (html.match(/>Copy</g) || []).length;
    const copiedButtonCount = (html.match(/>Copied</g) || []).length;

    // Both identical blocks render their own "Copy" affordance ...
    expect(copyButtonCount).toBe(2);
    // ... and neither is (falsely) shown as already copied on initial render.
    expect(copiedButtonCount).toBe(0);
  });
});
