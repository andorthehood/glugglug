import type { ShaderError, ShaderErrorHandler } from '../types';

type CreateProgramOptions = {
	effectName?: string;
	onShaderError?: ShaderErrorHandler;
	allowFailure?: boolean;
};

function parseErrorLine(infoLog: string | null): number | undefined {
	if (!infoLog) {
		return undefined;
	}
	const match = /ERROR:\s*0:(\d+):/.exec(infoLog);
	if (!match) {
		return undefined;
	}
	const line = Number.parseInt(match[1], 10);
	return Number.isNaN(line) ? undefined : line;
}

function emitShaderError(
	handler: ShaderErrorHandler | undefined,
	error: ShaderError
): void {
	if (!handler) {
		return;
	}
	handler(error);
}

export default function createProgram(
	gl: WebGL2RenderingContext,
	shaders: WebGLShader[],
	options?: Omit<CreateProgramOptions, 'allowFailure'> & { allowFailure?: false }
): WebGLProgram;
export default function createProgram(
	gl: WebGL2RenderingContext,
	shaders: WebGLShader[],
	options: CreateProgramOptions & { allowFailure: true }
): WebGLProgram | null;
export default function createProgram(
	gl: WebGL2RenderingContext,
	shaders: WebGLShader[],
	options: CreateProgramOptions = {}
): WebGLProgram | null {
	const program = gl.createProgram();
	if (!program) {
		throw new Error('Failed to create program');
	}

	shaders.forEach(shader => {
		gl.attachShader(program, shader);
	});

	gl.linkProgram(program);

	const linked = gl.getProgramParameter(program, gl.LINK_STATUS);

	if (!linked) {
		const infoLog = gl.getProgramInfoLog(program) || 'Unknown program link error';
		const error: ShaderError = {
			stage: 'link',
			effectName: options.effectName,
			line: parseErrorLine(infoLog),
			infoLog,
		};

		emitShaderError(options.onShaderError, error);
		gl.deleteProgram(program);

		if (options.allowFailure) {
			return null;
		}

		throw new Error(`Error in program linking: ${infoLog}`);
	}

	return program;
}
