/**
 * Uniform buffer mapping - maps uniform names to buffer locations
 */
export interface UniformBufferMapping {
	buffer: Float32Array;
	offset: number;
	size?: number; // 1 for float, 2 for vec2, 3 for vec3, 4 for vec4
}

/**
 * Post-process effect definition
 */
export interface PostProcessEffect {
	vertexShader: string;
	fragmentShader: string;
	uniforms?: Record<string, UniformBufferMapping>;
}

/**
 * Effect uniform update values
 */
export interface EffectUniforms {
	[key: string]: number | number[];
}
