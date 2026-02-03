import createProgram from '../utils/createProgram';
import createShader from '../utils/createShader';

import type { BackgroundEffect } from '../types/background';
import type { EffectUniforms } from '../types/postProcess';

/**
 * Manages a single background effect with buffer-based uniforms.
 * Renders a full-screen quad before sprites; does nothing when no effect is set.
 */
export class BackgroundEffectManager {
	private gl: WebGL2RenderingContext;
	private effect: BackgroundEffect | null = null;
	private program: WebGLProgram | null = null;
	private uniformLocations: Map<string, WebGLUniformLocation> = new Map();
	private sharedBuffer: Float32Array;
	private bufferSize: number;
	private positionBuffer: WebGLBuffer | null;

	// Standard uniform locations for the active effect
	private timeLocation: WebGLUniformLocation | null = null;
	private resolutionLocation: WebGLUniformLocation | null = null;

	constructor(gl: WebGL2RenderingContext, bufferSize: number = 256) {
		this.gl = gl;
		this.bufferSize = bufferSize;
		this.sharedBuffer = new Float32Array(bufferSize);

		// Create position buffer for full-screen quad
		this.positionBuffer = this.gl.createBuffer();
		if (!this.positionBuffer) {
			throw new Error('Failed to create WebGL buffer for background effect');
		}
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
	 * Set the active background effect, replacing any previous one
	 */
	setEffect(effect: BackgroundEffect): void {
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

				// Validate offset and size to prevent out-of-bounds accesses and NaN uniforms
				const offset = (mapping as any).offset;
				const size = (mapping as any).size;

				if (typeof offset !== 'number' || !Number.isInteger(offset) || offset < 0) {
					throw new Error(
						`Uniform "${uniformName}" has an invalid offset "${offset}". Offset must be a non-negative integer.`,
					);
				}

				if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > 4) {
					throw new Error(
						`Uniform "${uniformName}" has an invalid size "${size}". Size must be an integer between 1 and 4.`,
					);
				}

				if (offset + size > this.sharedBuffer.length) {
					throw new Error(
						`Uniform "${uniformName}" with offset ${offset} and size ${size} exceeds shared buffer length ${this.sharedBuffer.length}.`,
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
	 * Render the active background effect. Does nothing when no effect is set —
	 * the framebuffer clear color serves as the background in that case.
	 * @returns true if an effect was rendered, false otherwise
	 */
	render(elapsedTime: number, canvasWidth: number, canvasHeight: number): boolean {
		if (!this.effect || !this.program || !this.positionBuffer) {
			return false;
		}

		// Bind full-screen quad
		this.gl.bindBuffer(this.gl.ARRAY_BUFFER, this.positionBuffer);

		// Use effect shader
		this.gl.useProgram(this.program);

		// Set standard uniforms
		if (this.timeLocation) this.gl.uniform1f(this.timeLocation, elapsedTime);
		if (this.resolutionLocation) this.gl.uniform2f(this.resolutionLocation, canvasWidth, canvasHeight);

		// Set custom uniforms from buffer
		if (this.effect.uniforms) {
			for (const [uniformName, mapping] of Object.entries(this.effect.uniforms)) {
				const location = this.uniformLocations.get(uniformName);
				if (location) {
					const size = mapping.size || 1;
					const base = mapping.offset;

					switch (size) {
						case 1:
							this.gl.uniform1f(location, this.sharedBuffer[base]);
							break;
						case 2:
							this.gl.uniform2f(location, this.sharedBuffer[base], this.sharedBuffer[base + 1]);
							break;
						case 3:
							this.gl.uniform3f(
								location,
								this.sharedBuffer[base],
								this.sharedBuffer[base + 1],
								this.sharedBuffer[base + 2],
							);
							break;
						case 4:
							this.gl.uniform4f(
								location,
								this.sharedBuffer[base],
								this.sharedBuffer[base + 1],
								this.sharedBuffer[base + 2],
								this.sharedBuffer[base + 3],
							);
							break;
						default:
							console.warn(
								`BackgroundEffectManager: Unsupported uniform size '${size}' for '${uniformName}'. Expected 1–4.`,
							);
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

		return true;
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
		// Clear the active effect and associated program/uniform state
		this.clearEffect();

		// Delete and null out shared geometry buffer; make dispose idempotent
		if (this.positionBuffer) {
			this.gl.deleteBuffer(this.positionBuffer);
			this.positionBuffer = null;
		}
	}
}
