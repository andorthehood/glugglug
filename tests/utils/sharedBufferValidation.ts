import type { BackgroundEffect } from '../../src/types/background';
import type { PostProcessEffect } from '../../src/types/postProcess';

/**
 * Shared test helper for buffer validation tests.
 * Runs identical validation tests for both BackgroundEffectManager and PostProcessManager.
 */
export function runBufferValidationTests<TEffect extends BackgroundEffect | PostProcessEffect>(
	getManager: () => { setEffect: (effect: TEffect) => void; getBuffer: () => Float32Array },
	createEffect: (uniforms: any) => TEffect,
) {
	it('should throw error when uniform mapping references different buffer', () => {
		const manager = getManager();
		const wrongBuffer = new Float32Array(256);
		const effect = createEffect({
			testUniform: {
				buffer: wrongBuffer, // Wrong buffer!
				offset: 0,
				size: 1,
			},
		});

		expect(() => manager.setEffect(effect)).toThrow(
			'Uniform "testUniform" references a different buffer. All uniforms must use the shared buffer returned by Engine.getPostProcessBuffer(), Engine.getBackgroundBuffer(), or PostProcessManager.getBuffer().',
		);
	});

	it('should throw error for negative offset', () => {
		const manager = getManager();
		const correctBuffer = manager.getBuffer();
		const effect = createEffect({
			testUniform: {
				buffer: correctBuffer,
				offset: -1, // Invalid negative offset
				size: 1,
			},
		});

		expect(() => manager.setEffect(effect)).toThrow(
			'Uniform "testUniform" has an invalid offset (-1). Offsets must be non-negative integers.',
		);
	});

	it('should throw error for non-integer offset', () => {
		const manager = getManager();
		const correctBuffer = manager.getBuffer();
		const effect = createEffect({
			testUniform: {
				buffer: correctBuffer,
				offset: 1.5, // Invalid non-integer offset
				size: 1,
			},
		});

		expect(() => manager.setEffect(effect)).toThrow(
			'Uniform "testUniform" has an invalid offset (1.5). Offsets must be non-negative integers.',
		);
	});

	it('should throw error for size less than 1', () => {
		const manager = getManager();
		const correctBuffer = manager.getBuffer();
		const effect = createEffect({
			testUniform: {
				buffer: correctBuffer,
				offset: 0,
				size: 0, // Invalid size
			},
		});

		expect(() => manager.setEffect(effect)).toThrow(
			'Uniform "testUniform" has an invalid size (0). Sizes must be integers between 1 and 4.',
		);
	});

	it('should throw error for size greater than 4', () => {
		const manager = getManager();
		const correctBuffer = manager.getBuffer();
		const effect = createEffect({
			testUniform: {
				buffer: correctBuffer,
				offset: 0,
				size: 5, // Invalid size
			},
		});

		expect(() => manager.setEffect(effect)).toThrow(
			'Uniform "testUniform" has an invalid size (5). Sizes must be integers between 1 and 4.',
		);
	});

	it('should throw error for non-integer size', () => {
		const manager = getManager();
		const correctBuffer = manager.getBuffer();
		const effect = createEffect({
			testUniform: {
				buffer: correctBuffer,
				offset: 0,
				size: 2.5, // Invalid non-integer size
			},
		});

		expect(() => manager.setEffect(effect)).toThrow(
			'Uniform "testUniform" has an invalid size (2.5). Sizes must be integers between 1 and 4.',
		);
	});

	it('should throw error when offset + size exceeds buffer length', () => {
		const manager = getManager();
		const correctBuffer = manager.getBuffer();
		const effect = createEffect({
			testUniform: {
				buffer: correctBuffer,
				offset: 254, // offset + size = 258 > 256
				size: 4,
			},
		});

		expect(() => manager.setEffect(effect)).toThrow(
			'Uniform "testUniform" with offset 254 and size 4 exceeds the shared buffer length (256).',
		);
	});
}
