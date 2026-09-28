/** Exported memory */
export declare const memory: WebAssembly.Memory;
// Exported runtime interface
export declare function __new(size: number, id: number): number;
export declare function __pin(ptr: number): number;
export declare function __unpin(ptr: number): void;
export declare function __collect(): void;
export declare const __rtti_base: number;
/**
 * src/glyph/genOverlay
 * @param seed `u32`
 * @returns `~lib/string/String`
 */
export declare function genOverlay(seed: number): string;
/**
 * src/glyph/genData
 * @param seed `u32`
 * @returns `~lib/string/String`
 */
export declare function genData(seed: number): string;
/**
 * src/glyph/genComposite
 * @returns `~lib/string/String`
 */
export declare function genComposite(): string;
/**
 * src/glyph/genScenePatch
 * @returns `~lib/string/String`
 */
export declare function genScenePatch(): string;
/**
 * src/glyph/genSceneShade
 * @returns `~lib/string/String`
 */
export declare function genSceneShade(): string;
/**
 * src/glyph/genSceneBg
 * @returns `~lib/string/String`
 */
export declare function genSceneBg(): string;
/**
 * src/glyph/genSceneFog
 * @returns `~lib/string/String`
 */
export declare function genSceneFog(): string;
/**
 * src/glyph/genKanaPalette
 * @returns `~lib/string/String`
 */
export declare function genKanaPalette(): string;
