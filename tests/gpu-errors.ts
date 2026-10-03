/** Console errors that mean a shader failed: GLSL on the WebGL 2 fallback, WGSL and WebGPU validation, and TSL node errors. */
export const GPU_ERROR = /Shader|WebGLProgram|WGSL|WebGPU|GPUValidationError|Invalid (ShaderModule|RenderPipeline|BindGroup)|THREE\.TSL/;
/** The backend WebGPURenderer should report: LIVISTONE_BACKEND=webgl withholds WebGPU from Chrome (playwright.config.ts). */
export const EXPECTED_BACKEND = process.env.LIVISTONE_BACKEND === 'webgl' ? 'webgl2-fallback' : 'webgpu';
