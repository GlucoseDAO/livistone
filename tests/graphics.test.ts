import { describe, expect, it } from 'vitest';
import { modestRenderer, reducedGraphics, softwareRenderer } from '../src/game/graphics';

describe('software renderer names', () => {
  it('flags SwiftShader, WARP and the generic software drivers', () => {
    expect(softwareRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero)))')).toBe(true);
    expect(softwareRenderer('Google SwiftShader')).toBe(true);
    expect(softwareRenderer('llvmpipe (LLVM 15.0.7, 256 bits)')).toBe(true);
    expect(softwareRenderer('softpipe')).toBe(true);
    expect(softwareRenderer('Microsoft Basic Render Driver')).toBe(true);
    expect(softwareRenderer('GDI Generic')).toBe(true);
    expect(softwareRenderer('D3D11 WARP')).toBe(true);
  });
  it('leaves discrete GPUs off the software list', () => {
    expect(softwareRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0)')).toBe(false);
    expect(softwareRenderer('ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0)')).toBe(false);
    expect(softwareRenderer('Apple M2')).toBe(false);
    expect(softwareRenderer('Intel(R) UHD Graphics')).toBe(false);
  });
});

describe('modest GPU names', () => {
  it('treats typical laptop integrated graphics as the phone mesh path', () => {
    expect(modestRenderer('Intel(R) UHD Graphics')).toBe(true);
    expect(modestRenderer('Intel(R) HD Graphics 620')).toBe(true);
    expect(modestRenderer('Intel(R) Iris Xe Graphics')).toBe(true);
    expect(modestRenderer('AMD Radeon Graphics')).toBe(true);
    expect(modestRenderer('AMD Radeon(TM) Graphics')).toBe(true);
    expect(modestRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0)')).toBe(false);
    expect(modestRenderer('ANGLE (AMD, AMD Radeon RX 6800 XT Direct3D11 vs_5_0)')).toBe(false);
    expect(modestRenderer('Intel(R) Arc A770 Graphics')).toBe(false);
    expect(modestRenderer('Apple M2')).toBe(false);
  });
});

describe('reduced graphics policy', () => {
  it('uses the phone mesh path for coarse pointers, software GL or a laptop iGPU', () => {
    expect(reducedGraphics({ coarse: true })).toBe(true);
    expect(reducedGraphics({ coarse: false, caveatFailed: true })).toBe(true);
    expect(reducedGraphics({ coarse: false, renderer: 'Google SwiftShader' })).toBe(true);
    expect(reducedGraphics({ coarse: false, renderer: 'Intel(R) UHD Graphics' })).toBe(true);
    expect(reducedGraphics({ coarse: false, renderer: 'AMD Radeon Graphics' })).toBe(true);
    expect(reducedGraphics({ coarse: false, renderer: 'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0)' })).toBe(false);
    expect(reducedGraphics({ coarse: false })).toBe(false);
  });
});
