export default function createProgram(gl: WebGL2RenderingContext, shaders: WebGLShader[]): WebGLProgram {
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
		const lastError = gl.getProgramInfoLog(program);
		gl.deleteProgram(program);
		throw new Error(`Error in program linking: ${lastError}`);
	}

	return program;
}
