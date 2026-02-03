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
	private positionBuffer: WebGLBuffer;

	// Standard uniform locations for the active effect
	private timeLocation: WebGLUniformLocation | null = null;
	private resolutionLocation: WebGLUniformLocation | null = null;

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
	 * Set the active background effect, replacing any previous one
	 */
	setEffect(effect: BackgroundEffect): void {
		this.clearEffect();

		// Compile shaders
		this.program = createProgram(this.gl, [
			createShader(this.gl, effect.fragmentShader, this.gl.FRAGMENT_SHADER),
			createShader(this.gl, effect.vertexShader, this.gl.VERTEX_SHADER),
		]);

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
	 */
	render(elapsedTime: number, canvasWidth: number, canvasHeight: number): void {
		if (!this.effect || !this.program) {
			return;
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
		if (this.program) {
			this.gl.deleteProgram(this.program);
		}
		this.uniformLocations.clear();

		if (this.positionBuffer) {
			this.gl.deleteBuffer(this.positionBuffer);
		}
	}
}
