import type { UniformBufferMapping } from './postProcess';

/**
 * Background effect definition
 */
export interface BackgroundEffect {
	vertexShader: string;
	fragmentShader: string;
	uniforms?: Record<string, UniformBufferMapping>;
}
