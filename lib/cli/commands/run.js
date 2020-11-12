'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.run = exports.getBinEntries = undefined;

var _asyncToGenerator2;

function _load_asyncToGenerator() {
  return _asyncToGenerator2 = _interopRequireDefault(require('babel-runtime/helpers/asyncToGenerator'));
}

let getBinEntries = exports.getBinEntries = (() => {
  var _ref3 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config) {
    const binFolders = new Set();
    const binEntries = new Map();

    // Setup the node_modules/.bin folders for analysis
    for (var _iterator2 = config.registryFolders, _isArray2 = Array.isArray(_iterator2), _i2 = 0, _iterator2 = _isArray2 ? _iterator2 : _iterator2[Symbol.iterator]();;) {
      var _ref4;

      if (_isArray2) {
        if (_i2 >= _iterator2.length) break;
        _ref4 = _iterator2[_i2++];
      } else {
        _i2 = _iterator2.next();
        if (_i2.done) break;
        _ref4 = _i2.value;
      }

      const registryFolder = _ref4;

      binFolders.add(path.resolve(config.cwd, registryFolder, '.bin'));
      binFolders.add(path.resolve(config.lockfileFolder, registryFolder, '.bin'));
    }

    // Same thing, but for the pnp dependencies, located inside the cache
    if (yield (_fs || _load_fs()).exists(`${config.lockfileFolder}/${(_constants || _load_constants()).PNP_FILENAME}`)) {
      const pnpApi = (0, (_dynamicRequire || _load_dynamicRequire()).dynamicRequire)(`${config.lockfileFolder}/${(_constants || _load_constants()).PNP_FILENAME}`);

      const packageLocator = pnpApi.findPackageLocator(`${config.cwd}/`);
      const packageInformation = pnpApi.getPackageInformation(packageLocator);

      for (var _iterator3 = packageInformation.packageDependencies.entries(), _isArray3 = Array.isArray(_iterator3), _i3 = 0, _iterator3 = _isArray3 ? _iterator3 : _iterator3[Symbol.iterator]();;) {
        var _ref6;

        if (_isArray3) {
          if (_i3 >= _iterator3.length) break;
          _ref6 = _iterator3[_i3++];
        } else {
          _i3 = _iterator3.next();
          if (_i3.done) break;
          _ref6 = _i3.value;
        }

        const _ref5 = _ref6;
        const name = _ref5[0];
        const reference = _ref5[1];

        const dependencyInformation = pnpApi.getPackageInformation({ name, reference });

        if (dependencyInformation.packageLocation) {
          binFolders.add(`${dependencyInformation.packageLocation}/.bin`);
        }
      }
    }

    // Build up a list of possible scripts by exploring the folders marked for analysis
    for (var _iterator4 = binFolders, _isArray4 = Array.isArray(_iterator4), _i4 = 0, _iterator4 = _isArray4 ? _iterator4 : _iterator4[Symbol.iterator]();;) {
      var _ref7;

      if (_isArray4) {
        if (_i4 >= _iterator4.length) break;
        _ref7 = _iterator4[_i4++];
      } else {
        _i4 = _iterator4.next();
        if (_i4.done) break;
        _ref7 = _i4.value;
      }

      const binFolder = _ref7;

      if (yield (_fs || _load_fs()).exists(binFolder)) {
        for (var _iterator5 = yield (_fs || _load_fs()).readdir(binFolder), _isArray5 = Array.isArray(_iterator5), _i5 = 0, _iterator5 = _isArray5 ? _iterator5 : _iterator5[Symbol.iterator]();;) {
          var _ref8;

          if (_isArray5) {
            if (_i5 >= _iterator5.length) break;
            _ref8 = _iterator5[_i5++];
          } else {
            _i5 = _iterator5.next();
            if (_i5.done) break;
            _ref8 = _i5.value;
          }

          const name = _ref8;

          binEntries.set(name, path.join(binFolder, name));
        }
      }
    }

    return binEntries;
  });

  return function getBinEntries(_x) {
    return _ref3.apply(this, arguments);
  };
})();

let run = exports.run = (() => {
  var _ref11 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (config, reporter, flags, args) {
    let realRunCommand = (() => {
      var _ref15 = (0, (_asyncToGenerator2 || _load_asyncToGenerator()).default)(function* (action, args) {
        // build up list of commands
        const cmds = [];

        if (pkgScripts && action in pkgScripts) {
          const preAction = `pre${action}`;
          if (preAction in pkgScripts) {
            cmds.push([preAction, pkgScripts[preAction]]);
          }

          const script = scripts.get(action);
          invariant(script, 'Script must exist');
          cmds.push([action, script]);

          const postAction = `post${action}`;
          if (postAction in pkgScripts) {
            cmds.push([postAction, pkgScripts[postAction]]);
          }
        } else if (scripts.has(action)) {
          const script = scripts.get(action);
          invariant(script, 'Script must exist');
          cmds.push([action, script]);
        }

        if (cmds.length) {
          const ignoreEngines = !!(flags.ignoreEngines || config.getOption('ignore-engines'));
          try {
            yield (0, (_packageCompatibility || _load_packageCompatibility()).checkOne)(pkg, config, ignoreEngines);
          } catch (err) {
            throw err instanceof (_errors || _load_errors()).MessageError ? new (_errors || _load_errors()).MessageError(reporter.lang('cannotRunWithIncompatibleEnv')) : err;
          }

          // Disable wrapper in executed commands
          process.env.YARN_WRAP_OUTPUT = 'false';
          for (var _iterator9 = cmds, _isArray9 = Array.isArray(_iterator9), _i9 = 0, _iterator9 = _isArray9 ? _iterator9 : _iterator9[Symbol.iterator]();;) {
            var _ref17;

            if (_isArray9) {
              if (_i9 >= _iterator9.length) break;
              _ref17 = _iterator9[_i9++];
            } else {
              _i9 = _iterator9.next();
              if (_i9.done) break;
              _ref17 = _i9.value;
            }

            const _ref16 = _ref17;
            const stage = _ref16[0];
            const cmd = _ref16[1];

            // only tack on trailing arguments for default script, ignore for pre and post - #1595
            const cmdWithArgs = stage === action ? sh`${unquoted(cmd)} ${args}` : cmd;
            const customShell = config.getOption('script-shell');
            yield (0, (_executeLifecycleScript || _load_executeLifecycleScript()).execCommand)({
              stage,
              config,
              cmd: cmdWithArgs,
              cwd: flags.into || config.cwd,
              isInteractive: true,
              customShell: customShell ? String(customShell) : undefined
            });
          }
        } else if (action === 'env') {
          reporter.log(JSON.stringify((yield (0, (_executeLifecycleScript || _load_executeLifecycleScript()).makeEnv)('env', config.cwd, config)), null, 2), { force: true });
        } else {
          let suggestion;

          for (var _iterator10 = scripts.keys(), _isArray10 = Array.isArray(_iterator10), _i10 = 0, _iterator10 = _isArray10 ? _iterator10 : _iterator10[Symbol.iterator]();;) {
            var _ref18;

            if (_isArray10) {
              if (_i10 >= _iterator10.length) break;
              _ref18 = _iterator10[_i10++];
            } else {
              _i10 = _iterator10.next();
              if (_i10.done) break;
              _ref18 = _i10.value;
            }

            const commandName = _ref18;

            const steps = leven(commandName, action);
            if (steps < 2) {
              suggestion = commandName;
            }
          }

          let msg = `Command ${JSON.stringify(action)} not found.`;
          if (suggestion) {
            msg += ` Did you mean ${JSON.stringify(suggestion)}?`;
          }
          throw new (_errors || _load_errors()).MessageError(msg);
        }
      });

      return function realRunCommand(_x6, _x7) {
        return _ref15.apply(this, arguments);
      };
    })();

    // list possible scripts if none specified


    const pkg = yield config.readManifest(config.cwd);
    pkg.scripts = flatPkgScript(pkg.scripts);

    const binCommands = new Set();
    const pkgCommands = new Set();

    const scripts = new Map();

    for (var _iterator7 = yield getBinEntries(config), _isArray7 = Array.isArray(_iterator7), _i7 = 0, _iterator7 = _isArray7 ? _iterator7 : _iterator7[Symbol.iterator]();;) {
      var _ref13;

      if (_isArray7) {
        if (_i7 >= _iterator7.length) break;
        _ref13 = _iterator7[_i7++];
      } else {
        _i7 = _iterator7.next();
        if (_i7.done) break;
        _ref13 = _i7.value;
      }

      const _ref12 = _ref13;
      const name = _ref12[0];
      const loc = _ref12[1];

      scripts.set(name, quoteForShell(loc));
      binCommands.add(name);
    }

    const pkgScripts = pkg.scripts;

    if (pkgScripts) {
      const keys = Object.keys(pkgScripts).sort();
      for (var _iterator8 = keys, _isArray8 = Array.isArray(_iterator8), _i8 = 0, _iterator8 = _isArray8 ? _iterator8 : _iterator8[Symbol.iterator]();;) {
        var _ref14;

        if (_isArray8) {
          if (_i8 >= _iterator8.length) break;
          _ref14 = _iterator8[_i8++];
        } else {
          _i8 = _iterator8.next();
          if (_i8.done) break;
          _ref14 = _i8.value;
        }

        const name = _ref14;


        scripts.set(name, pkgScripts[name] || '');
        pkgCommands.add(name);
      }
    }

    function runCommand([action, ...args]) {
      return (0, (_hooks || _load_hooks()).callThroughHook)('runScript', () => realRunCommand(action, args), { action, args });
    }

    if (args.length === 0) {
      if (binCommands.size > 0) {
        reporter.info(`${reporter.lang('binCommands') + Array.from(binCommands).join(', ')}`);
      } else {
        reporter.error(reporter.lang('noBinAvailable'));
      }

      const printedCommands = new Map();

      for (var _iterator11 = pkgCommands, _isArray11 = Array.isArray(_iterator11), _i11 = 0, _iterator11 = _isArray11 ? _iterator11 : _iterator11[Symbol.iterator]();;) {
        var _ref19;

        if (_isArray11) {
          if (_i11 >= _iterator11.length) break;
          _ref19 = _iterator11[_i11++];
        } else {
          _i11 = _iterator11.next();
          if (_i11.done) break;
          _ref19 = _i11.value;
        }

        const pkgCommand = _ref19;

        const action = scripts.get(pkgCommand);
        invariant(action, 'Action must exists');
        printedCommands.set(pkgCommand, action);
      }

      if (pkgCommands.size > 0) {
        reporter.info(`${reporter.lang('possibleCommands')}`);
        reporter.list('possibleCommands', Array.from(pkgCommands), toObject(printedCommands));
        if (!flags.nonInteractive) {
          yield reporter.question(reporter.lang('commandQuestion')).then(function (answer) {
            return runCommand(answer.trim().split(' '));
          }, function () {
            return reporter.error(reporter.lang('commandNotSpecified'));
          });
        }
      } else {
        reporter.error(reporter.lang('noScriptsAvailable'));
      }
      return Promise.resolve();
    } else {
      return runCommand(args);
    }
  });

  return function run(_x2, _x3, _x4, _x5) {
    return _ref11.apply(this, arguments);
  };
})();

exports.setFlags = setFlags;
exports.hasWrapper = hasWrapper;

var _executeLifecycleScript;

function _load_executeLifecycleScript() {
  return _executeLifecycleScript = require('../../util/execute-lifecycle-script.js');
}

var _dynamicRequire;

function _load_dynamicRequire() {
  return _dynamicRequire = require('../../util/dynamic-require.js');
}

var _hooks;

function _load_hooks() {
  return _hooks = require('../../util/hooks.js');
}

var _errors;

function _load_errors() {
  return _errors = require('../../errors.js');
}

var _packageCompatibility;

function _load_packageCompatibility() {
  return _packageCompatibility = require('../../package-compatibility.js');
}

var _fs;

function _load_fs() {
  return _fs = _interopRequireWildcard(require('../../util/fs.js'));
}

var _constants;

function _load_constants() {
  return _constants = _interopRequireWildcard(require('../../constants.js'));
}

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } else { var newObj = {}; if (obj != null) { for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) newObj[key] = obj[key]; } } newObj.default = obj; return newObj; } }

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

const invariant = require('invariant');

const leven = require('leven');
const path = require('path');

var _require = require('puka');

const quoteForShell = _require.quoteForShell,
      sh = _require.sh,
      unquoted = _require.unquoted;


function toObject(input) {
  const output = Object.create(null);

  for (var _iterator = input.entries(), _isArray = Array.isArray(_iterator), _i = 0, _iterator = _isArray ? _iterator : _iterator[Symbol.iterator]();;) {
    var _ref2;

    if (_isArray) {
      if (_i >= _iterator.length) break;
      _ref2 = _iterator[_i++];
    } else {
      _i = _iterator.next();
      if (_i.done) break;
      _ref2 = _i.value;
    }

    const _ref = _ref2;
    const key = _ref[0];
    const val = _ref[1];

    output[key] = val;
  }

  return output;
}

function setFlags(commander) {
  commander.description('Runs a defined package script.');
}

function hasWrapper(commander, args) {
  return true;
}

function flatPkgScript(entry, base = '') {
  if (!entry) {
    return entry;
  }
  let next = {};
  if (typeof entry === 'object') {
    for (var _iterator6 = Object.entries(entry), _isArray6 = Array.isArray(_iterator6), _i6 = 0, _iterator6 = _isArray6 ? _iterator6 : _iterator6[Symbol.iterator]();;) {
      var _ref10;

      if (_isArray6) {
        if (_i6 >= _iterator6.length) break;
        _ref10 = _iterator6[_i6++];
      } else {
        _i6 = _iterator6.next();
        if (_i6.done) break;
        _ref10 = _i6.value;
      }

      const _ref9 = _ref10;
      const key = _ref9[0];
      const script = _ref9[1];

      const parsedKey = base ? `${base}.${key}` : key;
      if (typeof script === 'string') {
        next[parsedKey] = script;
      } else {
        next = Object.assign(next, flatPkgScript(script, parsedKey));
      }
    }
  }
  return next;
}