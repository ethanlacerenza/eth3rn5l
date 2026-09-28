async function instantiate(module, imports = {}) {
  const adaptedImports = {
    env: Object.assign(Object.create(globalThis), imports.env || {}, {
      abort(message, fileName, lineNumber, columnNumber) {
        // ~lib/builtins/abort(~lib/string/String | null?, ~lib/string/String | null?, u32?, u32?) => void
        message = __liftString(message >>> 0);
        fileName = __liftString(fileName >>> 0);
        lineNumber = lineNumber >>> 0;
        columnNumber = columnNumber >>> 0;
        (() => {
          // @external.js
          throw Error(`${message} in ${fileName}:${lineNumber}:${columnNumber}`);
        })();
      },
    }),
  };
  const { exports } = await WebAssembly.instantiate(module, adaptedImports);
  const memory = exports.memory || imports.env.memory;
  const adaptedExports = Object.setPrototypeOf({
    genOverlay(seed) {
      // src/glyph/genOverlay(u32) => ~lib/string/String
      return __liftString(exports.genOverlay(seed) >>> 0);
    },
    genData(seed) {
      // src/glyph/genData(u32) => ~lib/string/String
      return __liftString(exports.genData(seed) >>> 0);
    },
    genComposite() {
      // src/glyph/genComposite() => ~lib/string/String
      return __liftString(exports.genComposite() >>> 0);
    },
    genScenePatch() {
      // src/glyph/genScenePatch() => ~lib/string/String
      return __liftString(exports.genScenePatch() >>> 0);
    },
    genSceneShade() {
      // src/glyph/genSceneShade() => ~lib/string/String
      return __liftString(exports.genSceneShade() >>> 0);
    },
    genSceneBg() {
      // src/glyph/genSceneBg() => ~lib/string/String
      return __liftString(exports.genSceneBg() >>> 0);
    },
    genSceneFog() {
      // src/glyph/genSceneFog() => ~lib/string/String
      return __liftString(exports.genSceneFog() >>> 0);
    },
    genKanaPalette() {
      // src/glyph/genKanaPalette() => ~lib/string/String
      return __liftString(exports.genKanaPalette() >>> 0);
    },
  }, exports);
  function __liftString(pointer) {
    if (!pointer) return null;
    const
      end = pointer + new Uint32Array(memory.buffer)[pointer - 4 >>> 2] >>> 1,
      memoryU16 = new Uint16Array(memory.buffer);
    let
      start = pointer >>> 1,
      string = "";
    while (end - start > 1024) string += String.fromCharCode(...memoryU16.subarray(start, start += 1024));
    return string + String.fromCharCode(...memoryU16.subarray(start, end));
  }
  return adaptedExports;
}
export const {
  memory,
  __new,
  __pin,
  __unpin,
  __collect,
  __rtti_base,
  genOverlay,
  genData,
  genComposite,
  genScenePatch,
  genSceneShade,
  genSceneBg,
  genSceneFog,
  genKanaPalette,
} = await (async url => instantiate(
  await (async () => {
    const isNodeOrBun = typeof process != "undefined" && process.versions != null && (process.versions.node != null || process.versions.bun != null);
    if (isNodeOrBun) { return globalThis.WebAssembly.compile(await (await import("node:fs/promises")).readFile(url)); }
    else { return await globalThis.WebAssembly.compileStreaming(globalThis.fetch(url)); }
  })(), {
  }
))(new URL("glyph.wasm", import.meta.url));
