import type { UniformBufferMapping } from '../types/postProcess';

/**
 * Validates uniform buffer mappings to ensure they are valid before shader compilation.
 * This prevents GPU resource leaks and runtime errors.
 *
 * @param uniforms - The uniform mappings to validate
 * @param sharedBuffer - The shared buffer that all mappings must reference
 * @throws Error if any mapping is invalid
 */
export function validateUniformMappings(
	uniforms: Record<string, UniformBufferMapping> | undefined,
	sharedBuffer: Float32Array,
): void {
	if (!uniforms) return;

	for (const [uniformName, mapping] of Object.entries(uniforms)) {
		// Validate that all mappings reference the shared buffer
		if (mapping.buffer !== sharedBuffer) {
			throw new Error(
				`Uniform "${uniformName}" references a different buffer. All uniforms must use the shared buffer returned by Engine.getPostProcessBuffer(), Engine.getBackgroundBuffer(), or PostProcessManager.getBuffer().`,
			);
		}

		// Validate offset and size to prevent out-of-bounds accesses and NaN uniforms
		const offset = mapping.offset;
		const size = mapping.size;

		if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
			throw new Error(
				`Uniform "${uniformName}" has an invalid offset (${offset}). Offsets must be non-negative integers.`,
			);
		}

		// size is optional in the mapping; if omitted, it defaults to 1 (see render logic).
		// When provided, validate that it is an integer between 1 and 4.
		if (size !== undefined) {
			if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > 4) {
				throw new Error(
					`Uniform "${uniformName}" has an invalid size (${size}). Sizes must be integers between 1 and 4.`,
				);
			}
		}

		const effectiveSize = typeof size === 'number' ? size : 1;

		if (offset + effectiveSize > sharedBuffer.length) {
			throw new Error(
				`Uniform "${uniformName}" with offset ${offset} and size ${effectiveSize} exceeds the shared buffer length (${sharedBuffer.length}).`,
			);
		}
	}
}
