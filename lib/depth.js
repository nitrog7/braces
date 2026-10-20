'use strict';

const { MAX_DEPTH } = require('./constants');

exports.maxDepth = options => {
  if (options.maxDepth === undefined) return MAX_DEPTH;
  if (!Number.isInteger(options.maxDepth) || options.maxDepth < 0) {
    throw new TypeError('Expected maxDepth to be a non-negative integer');
  }
  // Callers may tighten the policy, but cannot disable the stack-safety ceiling.
  return Math.min(MAX_DEPTH, options.maxDepth);
};

exports.checkDepth = (depth, maxDepth) => {
  if (depth > maxDepth) {
    const error = new RangeError(`AST nesting exceeds max depth (${maxDepth})`);
    error.code = 'BRACES_MAX_DEPTH';
    throw error;
  }
};
