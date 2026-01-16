export default function createShader(
	gl: WebGL2RenderingContext,
	shaderSource: string,
	shaderType: number
): WebGLShader {
	const shader = gl.createShader(shaderType);
	if (!shader) {
		throw new Error('Failed to create shader');
	}
	gl.shaderSource(shader, shaderSource);
	gl.compileShader(shader);

	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		console.error('Could not compile web gl shader', info);
	}

	return shader;
}
