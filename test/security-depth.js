'use strict';

const assert = require('assert');
const braces = require('..');

const pattern = (count, open = '{', close = '}') => open.repeat(count) + 'a' + close.repeat(count);
const tree = count => {
  const root = { type: 'root', nodes: [] };
  let node = root;
  for (let depth = 0; depth < count; depth++) {
    const child = { type: 'paren', nodes: [], parent: node };
    node.nodes.push(child);
    node = child;
  }
  node.nodes.push({ type: 'text', value: 'a', parent: node });
  return root;
};
const depthError = error => error instanceof RangeError && error.code === 'BRACES_MAX_DEPTH';

describe('security: bounded recursive AST depth', () => {
  for (const method of ['parse', 'compile', 'expand', 'stringify']) {
    it(`${method} rejects deeply nested braces below the character limit`, () => {
      assert.throws(() => braces[method](pattern(4500)), depthError);
    });
    it(`${method} rejects deeply nested parentheses and mixed blocks`, () => {
      assert.throws(() => braces[method](pattern(4500, '(', ')')), depthError);
      assert.throws(() => braces[method](pattern(51, '{(', ')}')), depthError);
    });
    it(`${method} accepts the exact limit and rejects one level above it`, () => {
      assert.doesNotThrow(() => braces[method](pattern(100)));
      assert.throws(() => braces[method](pattern(101)), depthError);
      assert.doesNotThrow(() => braces[method](pattern(2), { maxDepth: 2 }));
      assert.throws(() => braces[method](pattern(3), { maxDepth: 2 }), depthError);
    });
    it(`${method} cannot disable the hard limit through options`, () => {
      assert.throws(() => braces[method](pattern(101), { maxDepth: 10000 }), depthError);
      for (const maxDepth of [-1, 1.5, NaN, Infinity, false, '100', null]) {
        assert.throws(() => braces[method]('a', { maxDepth }), TypeError);
      }
    });
  }

  for (const method of ['compile', 'expand', 'stringify']) {
    it(`${method} bounds externally supplied ASTs without relying on parse`, () => {
      assert.doesNotThrow(() => braces[method](tree(100)));
      assert.throws(() => braces[method](tree(101)), depthError);
      assert.throws(() => braces[method](tree(4500)), depthError);
      assert.throws(() => braces[method](tree(3), { maxDepth: 2 }), depthError);
    });
    it(`${method} terminates child cycles with a controlled error`, () => {
      const root = tree(0);
      root.nodes = [root];
      assert.throws(() => braces[method](root), depthError);
    });
  }

  it('expand terminates cyclic and excessive parent chains', () => {
    const root = tree(1);
    root.nodes[0].parent = root.nodes[0];
    assert.throws(() => braces.expand(root), depthError);
  });

  it('counts parsed blocks rather than escaped, quoted or bracketed literals', () => {
    for (const input of ['\\{'.repeat(150), '"' + '{'.repeat(150) + '"', '[' + '{'.repeat(150) + ']']) {
      assert.doesNotThrow(() => braces.compile(input, { maxDepth: 0 }));
    }
    assert.strictEqual(braces.compile('a', { maxDepth: 0 }), 'a');
    assert.throws(() => braces.parse('{a}', { maxDepth: 0 }), depthError);
  });

  it('protects the default, create and expansion entry points', () => {
    const input = pattern(4500);
    assert.throws(() => braces(input), depthError);
    assert.throws(() => braces.create(input), depthError);
    assert.throws(() => braces(['a', input]), depthError);
    assert.throws(() => braces(input, { expand: true }), depthError);
  });

  it('preserves normal glob alternatives, ranges and literal output', () => {
    assert.deepStrictEqual(braces.expand('src/{a,b}/{1..3}.js'), [
      'src/a/1.js', 'src/a/2.js', 'src/a/3.js', 'src/b/1.js', 'src/b/2.js', 'src/b/3.js'
    ]);
    assert.strictEqual(braces.compile('src/{a,b}/{1..3}.js'), 'src/(a|b)/([1-3]).js');
    assert.strictEqual(braces.stringify(braces.parse('a/{b,c}/d')), 'a/{b,c}/d');
  });
});
