export type SpriteCoordinates = {
	spriteWidth: number;
	spriteHeight: number;
	x: number;
	y: number;
};

export type SpriteLookup = Record<string | number, SpriteCoordinates>;

export type ShaderErrorStage = 'vertex' | 'fragment' | 'link';

export type ShaderError = {
	stage: ShaderErrorStage;
	effectName?: string;
	line?: number;
	infoLog: string;
};

export type ShaderErrorHandler = (error: ShaderError) => void;

export type EngineOptions = {
	/** Enable caching functionality. Defaults to false. */
	caching?: boolean;
	/** Maximum number of cache items when caching is enabled. Defaults to 50. */
	maxCacheItems?: number;
	/** Optional callback for shader compile/link errors. */
	onShaderError?: ShaderErrorHandler;
};
