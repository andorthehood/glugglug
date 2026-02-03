import createProgram from '../utils/createProgram';
import createShader from '../utils/createShader';

import type { PostProcessEffect, EffectUniforms } from '../types/postProcess';

/**
 * Manages a single post-processing effect with buffer-based uniforms
 */
export class PostProcessManager {
	private gl: WebGL2RenderingContext;
	private effect: PostProcessEffect | null = null;
	private program: WebGLProgram | null = null;
	private uniformLocations: Map<string, WebGLUniformLocation> = new Map();
	private sharedBuffer: Float32Array;
	private bufferSize: number;
	private positionBuffer: WebGLBuffer;

	// Standard uniform locations for the active effect
	private timeLocation: WebGLUniformLocation | null = null;
	private resolutionLocation: WebGLUniformLocation | null = null;
	private textureLocation: WebGLUniformLocation | null = null;

	// Fallback rendering (simple texture passthrough)
	private fallbackProgram: WebGLProgram | null = null;
	private fallbackTextureLocation: WebGLUniformLocation | null = null;

	constructor(gl: WebGL2RenderingContext, bufferSize: number = 256) {
		this.gl = gl;
		this.bufferSize = bufferSize;
		this.sharedBuffer = new Float32Array(bufferSize);

		// Create position buffer for full-screen quad
		this.positionBuffer = this.gl.createBuffer()!;
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);
		const quadVertices = new Float32Array([
			-1,
			-1, // bottom-left
			1,
			-1, // bottom-right
			-1,
			1, // top-left
			1,
			1, // top-right
		]);
		this.gl.bufferData(this.gl.ARRAY_BUFFER, quadVertices, this.gl.STATIC_DRAW);
	}

	/**
	 * Set the active post-process effect, replacing any previous one
	 */
	setEffect(effect: PostProcessEffect): void {
		// Clear previous effect if any
		this.clearEffect();

		// Validate uniform buffer mappings BEFORE shader compilation to avoid GPU leaks
		if (effect.uniforms) {
			for (const [uniformName, mapping] of Object.entries(effect.uniforms)) {
				// Validate that all mappings reference this manager's shared buffer
				if (mapping.buffer !== this.sharedBuffer) {
					throw new Error(
						`Uniform "${uniformName}" references a different buffer. All uniforms must use the buffer from getBuffer().`,
					);
				}

				// Validate offset and size for the shared buffer
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

				if (offset + effectiveSize > this.sharedBuffer.length) {
					throw new Error(
						`Uniform "${uniformName}" with offset ${offset} and size ${effectiveSize} exceeds the shared buffer length (${this.sharedBuffer.length}).`,
					);
				}
			}
		}

		// Compile shaders
		let vertexShader: WebGLShader | null = null;
		let fragmentShader: WebGLShader | null = null;

		try {
			vertexShader = createShader(this.gl, effect.vertexShader, this.gl.VERTEX_SHADER);
			fragmentShader = createShader(this.gl, effect.fragmentShader, this.gl.FRAGMENT_SHADER);
			this.program = createProgram(this.gl, [fragmentShader, vertexShader]);

			// Delete shaders after successful linking to avoid GPU resource leaks
			this.gl.deleteShader(vertexShader);
			this.gl.deleteShader(fragmentShader);
		} catch (error) {
			// Clean up any shaders that were successfully created before the error
			if (vertexShader) this.gl.deleteShader(vertexShader);
			if (fragmentShader) this.gl.deleteShader(fragmentShader);
			throw error;
		}

		// Get standard uniform locations
		this.timeLocation = this.gl.getUniformLocation(this.program, 'u_time');
		this.resolutionLocation = this.gl.getUniformLocation(this.program, 'u_resolution');
		this.textureLocation = this.gl.getUniformLocation(this.program, 'u_renderTexture');

		// Get custom uniform locations from buffer mapping
		this.uniformLocations.clear();
		if (effect.uniforms) {
			for (const uniformName of Object.keys(effect.uniforms)) {
				const location = this.gl.getUniformLocation(this.program, uniformName);
				if (location) {
					this.uniformLocations.set(uniformName, location);
				}
			}
		}

		this.effect = effect;
	}

	/**
	 * Update uniform values in the shared buffer
	 */
	updateUniforms(uniforms: EffectUniforms): void {
		if (!this.effect?.uniforms) return;

		for (const [uniformName, value] of Object.entries(uniforms)) {
			const mapping = this.effect.uniforms[uniformName];
			if (!mapping) continue;

			if (Array.isArray(value)) {
				for (let i = 0; i < value.length && i < (mapping.size || 1); i++) {
					this.sharedBuffer[mapping.offset + i] = value[i];
				}
			} else {
				this.sharedBuffer[mapping.offset] = value;
			}
		}
	}

	/**
	 * Render the active effect, or fall back to passthrough when none is set
	 */
	render(renderTexture: WebGLTexture, elapsedTime: number, canvasWidth: number, canvasHeight: number): void {
		if (!this.effect || !this.program) {
			this.renderFallback(renderTexture);
			return;
		}

		// Bind full-screen quad
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

		// Use effect shader
		this.gl.useProgram(this.program);

		// Bind render texture
		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, renderTexture);

		// Set standard uniforms
		if (this.timeLocation) this.gl.uniform1f(this.timeLocation, elapsedTime);
		if (this.resolutionLocation) this.gl.uniform2f(this.resolutionLocation, canvasWidth, canvasHeight);
		if (this.textureLocation) this.gl.uniform1i(this.textureLocation, 0);

		// Set custom uniforms from buffer
		if (this.effect.uniforms) {
			for (const [uniformName, mapping] of Object.entries(this.effect.uniforms)) {
				const location = this.uniformLocations.get(uniformName);
				if (location) {
					const size = mapping.size || 1;
					const values = this.sharedBuffer.slice(mapping.offset, mapping.offset + size);

					switch (size) {
						case 1:
							this.gl.uniform1f(location, values[0]);
							break;
						case 2:
							this.gl.uniform2f(location, values[0], values[1]);
							break;
						case 3:
							this.gl.uniform3f(location, values[0], values[1], values[2]);
							break;
						case 4:
							this.gl.uniform4f(location, values[0], values[1], values[2], values[3]);
							break;
					}
				}
			}
		}

		// Configure vertex attributes
		const a_position = this.gl.getAttribLocation(this.program, 'a_position');
		if (a_position !== -1) {
			this.gl.vertexAttribPointer(a_position, 2, this.gl.FLOAT, false, 0, 0);
			this.gl.enableVertexAttribArray(a_position);
		}

		// Render full-screen quad
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
	}

	/**
	 * Fallback rendering - simple texture passthrough when no effect is set
	 */
	private renderFallback(renderTexture: WebGLTexture): void {
		// Create simple passthrough shaders if not already created
		if (!this.fallbackProgram) {
			this.createFallbackShaders();
		}

		// Bind full-screen quad
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

		// Use fallback shader
		this.gl.useProgram(this.fallbackProgram!);

		// Bind render texture
		this.gl.activeTexture(this.gl.TEXTURE0);
		this.gl.bindTexture(this.gl.TEXTURE_2D, renderTexture);

		// Set texture uniform
		if (this.fallbackTextureLocation) {
			this.gl.uniform1i(this.fallbackTextureLocation, 0);
		}

		// Configure vertex attributes
		const a_position = this.gl.getAttribLocation(this.fallbackProgram!, 'a_position');
		if (a_position !== -1) {
			this.gl.vertexAttribPointer(a_position, 2, this.gl.FLOAT, false, 0, 0);
			this.gl.enableVertexAttribArray(a_position);
		}

		// Render full-screen quad
		this.gl.drawArrays(this.gl.TRIANGLE_STRIP, 0, 4);
	}

	/**
	 * Create simple fallback shaders for texture passthrough
	 */
	private createFallbackShaders(): void {
		const fallbackVertexShader = `#version 300 es
precision mediump float;
in vec2 a_position;
out vec2 v_screenCoord;

void main() {
	gl_Position = vec4(a_position, 0, 1);
	v_screenCoord = (a_position + 1.0) / 2.0;
}
`;

		const fallbackFragmentShader = `#version 300 es
precision mediump float;
in vec2 v_screenCoord;
uniform sampler2D u_renderTexture;
out vec4 outColor;

void main() {
	outColor = texture(u_renderTexture, v_screenCoord);
}
`;

		// Compile fallback shaders
		let vertexShader: WebGLShader | null = null;
		let fragmentShader: WebGLShader | null = null;

		try {
			vertexShader = createShader(this.gl, fallbackVertexShader, this.gl.VERTEX_SHADER);
			fragmentShader = createShader(this.gl, fallbackFragmentShader, this.gl.FRAGMENT_SHADER);
			this.fallbackProgram = createProgram(this.gl, [fragmentShader, vertexShader]);

			// Delete shaders after successful linking to avoid GPU resource leaks
			this.gl.deleteShader(vertexShader);
			this.gl.deleteShader(fragmentShader);
		} catch (error) {
			// Clean up any shaders that were successfully created before the error
			if (vertexShader) this.gl.deleteShader(vertexShader);
			if (fragmentShader) this.gl.deleteShader(fragmentShader);
			throw error;
		}

		// Get texture uniform location
		this.fallbackTextureLocation = this.gl.getUniformLocation(this.fallbackProgram, 'u_renderTexture');
	}

	/**
	 * Remove the active effect and free its GPU program
	 */
	clearEffect(): void {
		if (this.program) {
			this.gl.deleteProgram(this.program);
			this.program = null;
		}

		this.uniformLocations.clear();
		this.timeLocation = null;
		this.resolutionLocation = null;
		this.textureLocation = null;
		this.effect = null;
	}

	/**
	 * Get direct access to the shared buffer for advanced use cases
	 */
	getBuffer(): Float32Array {
		return this.sharedBuffer;
	}

	/**
	 * Clean up resources
	 */
	dispose(): void {
		if (this.program) {
			this.gl.deleteProgram(this.program);
		}
		this.uniformLocations.clear();

		if (this.positionBuffer) {
			this.gl.deleteBuffer(this.positionBuffer);
		}
	}
}
