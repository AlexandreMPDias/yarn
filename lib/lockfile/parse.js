'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

exports.default = function (str, fileLoc = 'lockfile') {
  str = (0, (_stripBom || _load_stripBom()).default)(str);
  return hasMergeConflicts(str) ? parseWithConflict(str, fileLoc) : { type: 'success', object: parse(str, fileLoc) };
};

var _util;

function _load_util() {
  return _util = _interopRequireDefault(require('util'));
}

var _invariant;

function _load_invariant() {
  return _invariant = _interopRequireDefault(require('invariant'));
}

var _stripBom;

function _load_stripBom() {
  return _stripBom = _interopRequireDefault(require('strip-bom'));
}

var _constants;

function _load_constants() {
  return _constants = require('../constants.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../errors.js');
}

var _map;

function _load_map() {
  return _map = _interopRequireDefault(require('../util/map.js'));
}

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

/* eslint quotes: 0 */

var _require = require('js-yaml');

const safeLoad = _require.safeLoad,
      FAILSAFE_SCHEMA = _require.FAILSAFE_SCHEMA;


const VERSION_REGEX = /^yarn lockfile v(\d+)$/;

const TOKEN_TYPES = {
  boolean: 'BOOLEAN',
  string: 'STRING',
  identifier: 'IDENTIFIER',
  eof: 'EOF',
  colon: 'COLON',
  newline: 'NEWLINE',
  comment: 'COMMENT',
  indent: 'INDENT',
  invalid: 'INVALID',
  number: 'NUMBER',
  comma: 'COMMA'
};

const VALID_PROP_VALUE_TOKENS = [TOKEN_TYPES.boolean, TOKEN_TYPES.string, TOKEN_TYPES.number];

function isValidPropValueToken(token) {
  return VALID_PROP_VALUE_TOKENS.indexOf(token.type) >= 0;
}

function* tokenise(input) {
  let lastNewline = false;
  let line = 1;
  let col = 0;

  function buildToken(type, value) {
    return { line, col, type, value };
  }

  while (input.length) {
    let chop = 0;

    if (input[0] === '\n' || input[0] === '\r') {
      chop++;
      // If this is a \r\n line, ignore both chars but only add one new line
      if (input[1] === '\n') {
        chop++;
      }
      line++;
      col = 0;
      yield buildToken(TOKEN_TYPES.newline);
    } else if (input[0] === '#') {
      chop++;

      let nextNewline = input.indexOf('\n', chop);
      if (nextNewline === -1) {
        nextNewline = input.length;
      }
      const val = input.substring(chop, nextNewline);
      chop = nextNewline;
      yield buildToken(TOKEN_TYPES.comment, val);
    } else if (input[0] === ' ') {
      if (lastNewline) {
        let indentSize = 1;
        for (let i = 1; input[i] === ' '; i++) {
          indentSize++;
        }

        if (indentSize % 2) {
          throw new TypeError('Invalid number of spaces');
        } else {
          chop = indentSize;
          yield buildToken(TOKEN_TYPES.indent, indentSize / 2);
        }
      } else {
        chop++;
      }
    } else if (input[0] === '"') {
      let i = 1;
      for (; i < input.length; i++) {
        if (input[i] === '"') {
          const isEscaped = input[i - 1] === '\\' && input[i - 2] !== '\\';
          if (!isEscaped) {
            i++;
            break;
          }
        }
      }
      const val = input.substring(0, i);

      chop = i;

      try {
        yield buildToken(TOKEN_TYPES.string, JSON.parse(val));
      } catch (err) {
        if (err instanceof SyntaxError) {
          yield buildToken(TOKEN_TYPES.invalid);
        } else {
          throw err;
        }
      }
    } else if (/^[0-9]/.test(input)) {
      const val = /^[0-9]+/.exec(input)[0];
      chop = val.length;

      yield buildToken(TOKEN_TYPES.number, +val);
    } else if (/^true/.test(input)) {
      yield buildToken(TOKEN_TYPES.boolean, true);
      chop = 4;
    } else if (/^false/.test(input)) {
      yield buildToken(TOKEN_TYPES.boolean, false);
      chop = 5;
    } else if (input[0] === ':') {
      yield buildToken(TOKEN_TYPES.colon);
      chop++;
    } else if (input[0] === ',') {
      yield buildToken(TOKEN_TYPES.comma);
      chop++;
    } else if (/^[a-zA-Z\/.-]/g.test(input)) {
      let i = 0;
      for (; i < input.length; i++) {
        const char = input[i];
        if (char === ':' || char === ' ' || char === '\n' || char === '\r' || char === ',') {
          break;
        }
      }
      const name = input.substring(0, i);
      chop = i;

      yield buildToken(TOKEN_TYPES.string, name);
    } else {
      yield buildToken(TOKEN_TYPES.invalid);
    }

    if (!chop) {
      // will trigger infinite recursion
      yield buildToken(TOKEN_TYPES.invalid);
    }

    col += chop;
    lastNewline = input[0] === '\n' || input[0] === '\r' && input[1] === '\n';
    input = input.slice(chop);
  }

  yield buildToken(TOKEN_TYPES.eof);
}

class Parser {
  constructor(input, fileLoc = 'lockfile') {
    this.comments = [];
    this.tokens = tokenise(input);
    this.fileLoc = fileLoc;
  }

  onComment(token) {
    const value = token.value;
    (0, (_invariant || _load_invariant()).default)(typeof value === 'string', 'expected token value to be a string');

    const comment = value.trim();

    const versionMatch = comment.match(VERSION_REGEX);
    if (versionMatch) {
      const version = +versionMatch[1];
      if (version > (_constants || _load_constants()).LOCKFILE_VERSION) {
        throw new (_errors || _load_errors()).MessageError(`Can't install from a lockfile of version ${version} as you're on an old yarn version that only supports ` + `versions up to ${(_constants || _load_constants()).LOCKFILE_VERSION}. Run \`$ yarn self-update\` to upgrade to the latest version.`);
      }
    }

    this.comments.push(comment);
  }

  next() {
    const item = this.tokens.next();
    (0, (_invariant || _load_invariant()).default)(item, 'expected a token');

    const done = item.done,
          value = item.value;

    if (done || !value) {
      throw new Error('No more tokens');
    } else if (value.type === TOKEN_TYPES.comment) {
      this.onComment(value);
      return this.next();
    } else {
      return this.token = value;
    }
  }

  unexpected(msg = 'Unexpected token') {
    throw new SyntaxError(`${msg} ${this.token.line}:${this.token.col} in ${this.fileLoc}`);
  }

  expect(tokType) {
    if (this.token.type === tokType) {
      this.next();
    } else {
      this.unexpected();
    }
  }

  eat(tokType) {
    if (this.token.type === tokType) {
      this.next();
      return true;
    } else {
      return false;
    }
  }

  parse(indent = 0) {
    const obj = (0, (_map || _load_map()).default)();

    while (true) {
      const propToken = this.token;

      if (propToken.type === TOKEN_TYPES.newline) {
        const nextToken = this.next();
        if (!indent) {
          // if we have 0 indentation then the next token doesn't matter
          continue;
        }

        if (nextToken.type !== TOKEN_TYPES.indent) {
          // if we have no indentation after a newline then we've gone down a level
          break;
        }

        if (nextToken.value === indent) {
          // all is good, the indent is on our level
          this.next();
        } else {
          // the indentation is less than our level
          break;
        }
      } else if (propToken.type === TOKEN_TYPES.indent) {
        if (propToken.value === indent) {
          this.next();
        } else {
          break;
        }
      } else if (propToken.type === TOKEN_TYPES.eof) {
        break;
      } else if (propToken.type === TOKEN_TYPES.string) {
        // property key
        const key = propToken.value;
        (0, (_invariant || _load_invariant()).default)(key, 'Expected a key');

        const keys = [key];
        this.next();

        // support multiple keys
        while (this.token.type === TOKEN_TYPES.comma) {
          this.next(); // skip comma

          const keyToken = this.token;
          if (keyToken.type !== TOKEN_TYPES.string) {
            this.unexpected('Expected string');
          }

          const key = keyToken.value;
          (0, (_invariant || _load_invariant()).default)(key, 'Expected a key');
          keys.push(key);
          this.next();
        }

        const wasColon = this.token.type === TOKEN_TYPES.colon;
        if (wasColon) {
          this.next();
        }

        if (isValidPropValueToken(this.token)) {
          // plain value
          for (var _iterator = keys, _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
            var _ref;

            if (_isArray) {
              if (_i >= _iterator.length) break;
              _ref = _iterator[_i++];
            } else {
              _i = _iterator.next();
              if (_i.done) break;
              _ref = _i.value;
            }

            const key = _ref;

            obj[key] = this.token.value;
          }

          this.next();
        } else if (wasColon) {
          // parse object
          const val = this.parse(indent + 1);

          for (var _iterator2 = keys, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
            var _ref2;

            if (_isArray2) {
              if (_i2 >= _iterator2.length) break;
              _ref2 = _iterator2[_i2++];
            } else {
              _i2 = _iterator2.next();
              if (_i2.done) break;
              _ref2 = _i2.value;
            }

            const key = _ref2;

            obj[key] = val;
          }

          if (indent && this.token.type !== TOKEN_TYPES.indent) {
            break;
          }
        } else {
          this.unexpected('Invalid value type');
        }
      } else {
        this.unexpected(`Unknown token: ${(_util || _load_util()).default.inspect(propToken)}`);
      }
    }

    return obj;
  }
}

const MERGE_CONFLICT_ANCESTOR = '|||||||';
const MERGE_CONFLICT_END = '>>>>>>>';
const MERGE_CONFLICT_SEP = '=======';
const MERGE_CONFLICT_START = '<<<<<<<';

/**
 * Extract the two versions of the lockfile from a merge conflict.
 */
function extractConflictVariants(str) {
  const variants = [[], []];
  const lines = str.split(/\r?\n/g);
  let skip = false;

  while (lines.length) {
    const line = lines.shift();
    if (line.startsWith(MERGE_CONFLICT_START)) {
      // get the first variant
      while (lines.length) {
        const conflictLine = lines.shift();
        if (conflictLine === MERGE_CONFLICT_SEP) {
          skip = false;
          break;
        } else if (skip || conflictLine.startsWith(MERGE_CONFLICT_ANCESTOR)) {
          skip = true;
          continue;
        } else {
          variants[0].push(conflictLine);
        }
      }

      // get the second variant
      while (lines.length) {
        const conflictLine = lines.shift();
        if (conflictLine.startsWith(MERGE_CONFLICT_END)) {
          break;
        } else {
          variants[1].push(conflictLine);
        }
      }
    } else {
      variants[0].push(line);
      variants[1].push(line);
    }
  }

  return [variants[0].join('\n'), variants[1].join('\n')];
}

/**
 * Check if a lockfile has merge conflicts.
 */
function hasMergeConflicts(str) {
  return str.includes(MERGE_CONFLICT_START) && str.includes(MERGE_CONFLICT_SEP) && str.includes(MERGE_CONFLICT_END);
}

/**
 * Parse the lockfile.
 */
function parse(str, fileLoc) {
  const parser = new Parser(str, fileLoc);
  parser.next();

  if (!fileLoc.endsWith(`.yml`)) {
    try {
      return parser.parse();
    } catch (error1) {
      try {
        return safeLoad(str, {
          schema: FAILSAFE_SCHEMA
        });
      } catch (error2) {
        throw error1;
      }
    }
  } else {
    const result = safeLoad(str, {
      schema: FAILSAFE_SCHEMA
    });
    if (typeof result === 'object') {
      return result;
    } else {
      return {};
    }
  }
}

/**
 * Parse and merge the two variants in a conflicted lockfile.
 */
function parseWithConflict(str, fileLoc) {
  const variants = extractConflictVariants(str);
  try {
    return { type: 'merge', object: Object.assign({}, parse(variants[0], fileLoc), parse(variants[1], fileLoc)) };
  } catch (err) {
    if (err instanceof SyntaxError) {
      return { type: 'conflict', object: {} };
    } else {
      throw err;
    }
  }
}