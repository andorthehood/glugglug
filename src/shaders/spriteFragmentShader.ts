export default `#version 300 es
precision mediump float;

in vec2 v_texcoord;
uniform sampler2D u_texture;
uniform float u_time;

out vec4 outColor;

void main() {
	vec2 uv = v_texcoord;
	vec4 color = texture(u_texture, uv);
	outColor = color;
}
`;
