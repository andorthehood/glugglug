import type { ShaderError, ShaderErrorHandler, ShaderErrorStage } from '../types';

type CreateShaderOptions = {
	effectName?: string;
	onShaderError?: ShaderErrorHandler;
	allowFailure?: boolean;
};

function getShaderStage(gl: WebGL2RenderingContext, shaderType: number): ShaderErrorStage {
	if (shaderType === gl.VERTEX_SHADER) {
		return 'vertex';
	}
	return 'fragment';
}

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

export default function createShader(
	gl: WebGL2RenderingContext,
	shaderSource: string,
	shaderType: number,
	options?: Omit<CreateShaderOptions, 'allowFailure'> & { allowFailure?: false }
): WebGLShader;
export default function createShader(
	gl: WebGL2RenderingContext,
	shaderSource: string,
	shaderType: number,
	options: CreateShaderOptions & { allowFailure: true }
): WebGLShader | null;
export default function createShader(
	gl: WebGL2RenderingContext,
	shaderSource: string,
	shaderType: number,
	options: CreateShaderOptions = {}
): WebGLShader | null {
	const shader = gl.createShader(shaderType);
	if (!shader) {
		throw new Error('Failed to create shader');
	}

	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const infoLog = gl.getShaderInfoLog(shader) || 'Unknown shader error';
		const stage = getShaderStage(gl, shaderType);
		const error: ShaderError = {
			stage,
			effectName: options.effectName,
			line: parseErrorLine(infoLog),
			infoLog,
		};

		emitShaderError(options.onShaderError, error);
		gl.deleteShader(shader);

		if (options.allowFailure) {
			return null;
		}

		throw new Error(`Error compiling ${stage} shader: ${infoLog}`);
	}

	return shader;
}
