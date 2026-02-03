import { PostProcessManager } from '../../src/postProcess/PostProcessManager';
import type { PostProcessEffect } from '../../src/types/postProcess';

// Mock WebGL objects
const mockShader = {} as WebGLShader;
const mockProgram = {} as WebGLProgram;
const mockBuffer = {} as WebGLBuffer;
const mockUniformLocation = {} as WebGLUniformLocation;
const mockTexture = {} as WebGLTexture;

// Mock WebGL2 context
const createMockGL = () => {
	const gl = {
		// Constants
		VERTEX_SHADER: 35633,
		FRAGMENT_SHADER: 35632,
		ARRAY_BUFFER: 34962,
		STATIC_DRAW: 35044,
		FLOAT: 5126,
		TRIANGLE_STRIP: 5,
		TEXTURE_2D: 3553,
		TEXTURE0: 33984,

		// Mock methods
		createShader: jest.fn(() => mockShader),
		shaderSource: jest.fn(),
		compileShader: jest.fn(),
		getShaderParameter: jest.fn(() => true),
		getShaderInfoLog: jest.fn(() => ''),
		deleteShader: jest.fn(),
		createProgram: jest.fn(() => mockProgram),
		attachShader: jest.fn(),
		linkProgram: jest.fn(),
		getProgramParameter: jest.fn(() => true),
		getProgramInfoLog: jest.fn(() => ''),
		deleteProgram: jest.fn(),
		getUniformLocation: jest.fn(() => mockUniformLocation),
		createBuffer: jest.fn(() => mockBuffer),
		bindBuffer: jest.fn(),
		bufferData: jest.fn(),
		deleteBuffer: jest.fn(),
		useProgram: jest.fn(),
		uniform1f: jest.fn(),
		uniform2f: jest.fn(),
		uniform1i: jest.fn(),
		getAttribLocation: jest.fn(() => 0),
		vertexAttribPointer: jest.fn(),
		enableVertexAttribArray: jest.fn(),
		drawArrays: jest.fn(),
		activeTexture: jest.fn(),
		bindTexture: jest.fn(),
		viewport: jest.fn(),
	} as unknown as WebGL2RenderingContext;

	return gl;
};

describe('PostProcessManager', () => {
	let gl: WebGL2RenderingContext;
	let manager: PostProcessManager;

	beforeEach(() => {
		gl = createMockGL();
		manager = new PostProcessManager(gl, 256);
		// Clear mock call counts
		jest.clearAllMocks();
	});

	describe('buffer validation', () => {
		it('should throw error when uniform mapping references different buffer', () => {
			const wrongBuffer = new Float32Array(256);
			const effect: PostProcessEffect = {
				vertexShader: 'void main() {}',
				fragmentShader: 'void main() {}',
				uniforms: {
					testUniform: {
						buffer: wrongBuffer, // Wrong buffer!
						offset: 0,
						size: 1,
					},
				},
			};

			expect(() => manager.setEffect(effect)).toThrow(
				'Uniform "testUniform" references a different buffer. All uniforms must use the buffer from getBuffer().',
			);
		});

		it('should not create GPU program when buffer validation fails', () => {
			const wrongBuffer = new Float32Array(256);
			const effect: PostProcessEffect = {
				vertexShader: 'void main() {}',
				fragmentShader: 'void main() {}',
				uniforms: {
					testUniform: {
						buffer: wrongBuffer,
						offset: 0,
						size: 1,
					},
				},
			};

			try {
				manager.setEffect(effect);
			} catch (error) {
				// Error is expected
			}

			// Shader/program creation should NOT have been called
			expect(gl.createShader).not.toHaveBeenCalled();
			expect(gl.createProgram).not.toHaveBeenCalled();
		});

		it('should allow setting valid effect after buffer validation failure', () => {
			const wrongBuffer = new Float32Array(256);
			const invalidEffect: PostProcessEffect = {
				vertexShader: 'void main() {}',
				fragmentShader: 'void main() {}',
				uniforms: {
					testUniform: {
						buffer: wrongBuffer,
						offset: 0,
						size: 1,
					},
				},
			};

			// First, try to set invalid effect
			try {
				manager.setEffect(invalidEffect);
			} catch (error) {
				// Expected
			}

			// Clear mock call counts
			jest.clearAllMocks();

			// Now set a valid effect
			const correctBuffer = manager.getBuffer();
			const validEffect: PostProcessEffect = {
				vertexShader: 'void main() {}',
				fragmentShader: 'void main() {}',
				uniforms: {
					testUniform: {
						buffer: correctBuffer, // Correct buffer
						offset: 0,
						size: 1,
					},
				},
			};

			// Should not throw
			expect(() => manager.setEffect(validEffect)).not.toThrow();

			// Should have created shaders and program
			expect(gl.createShader).toHaveBeenCalledTimes(2);
			expect(gl.createProgram).toHaveBeenCalledTimes(1);
		});

		it('should accept effect with correct buffer reference', () => {
			const correctBuffer = manager.getBuffer();
			const effect: PostProcessEffect = {
				vertexShader: 'void main() {}',
				fragmentShader: 'void main() {}',
				uniforms: {
					testUniform: {
						buffer: correctBuffer,
						offset: 0,
						size: 1,
					},
				},
			};

			expect(() => manager.setEffect(effect)).not.toThrow();
		});

		it('should accept effect without uniforms', () => {
			const effect: PostProcessEffect = {
				vertexShader: 'void main() {}',
				fragmentShader: 'void main() {}',
			};

			expect(() => manager.setEffect(effect)).not.toThrow();
		});
	});
});
