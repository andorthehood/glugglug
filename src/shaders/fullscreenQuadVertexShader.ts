export const FULLSCREEN_QUAD_VERTEX_SHADER = `#version 300 es
precision mediump float;
in vec2 a_position;
out vec2 v_screenCoord;

void main() {
	gl_Position = vec4(a_position, 0, 1);
	v_screenCoord = (a_position + 1.0) / 2.0;
}
`;
