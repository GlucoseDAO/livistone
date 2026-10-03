import { describe, expect, it } from 'vitest';
import { graphicsProfile, graphicsTier, modestRenderer, reducedGraphics, softwareRenderer } from '../src/game/graphics';

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
  it('recognises newer integrated GPUs that drop the UHD/Iris names, but not discrete Arc or Radeon cards', () => {
    for (const name of ['ANGLE (Intel, Mesa Intel(R) Graphics (RPL-S), OpenGL 4.6)', 'ANGLE (Intel, Intel(R) Graphics (0x0000A780) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) Arc(TM) Graphics (0x00007D55) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Intel(R) Arc(TM) 140V GPU', 'Intel(R) Arc(TM) 140T GPU',
      'Mesa Intel(R) Xe Graphics (TGL GT2)', 'Intel(R) Iris(R) Xe Graphics', 'AMD Radeon 780M Graphics', 'AMD Radeon(TM) Vega 8 Graphics']) expect(modestRenderer(name), name).toBe(true);
    for (const name of ['ANGLE (Intel, Intel(R) Arc(TM) A770 Graphics (0x000056A0) Direct3D11 vs_5_0 ps_5_0, D3D11)', 'Intel(R) Arc(TM) B580 Graphics',
      'AMD Radeon RX 7600M XT', 'AMD Radeon Pro 5500M', 'ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)']) expect(modestRenderer(name), name).toBe(false);
    expect(graphicsTier({ coarse: false, renderer: 'ANGLE (Intel, Mesa Intel(R) Graphics (RPL-S), OpenGL 4.6)' })).toBe('mobile');
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

describe('three world graphics profiles', () => {
  it('distinguishes software WebGL from phones and hardware GPUs', () => {
    expect(graphicsTier({ coarse: false, renderer: 'Google SwiftShader' })).toBe('cpu');
    expect(graphicsTier({ coarse: true, renderer: 'Google SwiftShader' })).toBe('cpu');
    expect(graphicsTier({ coarse: true, renderer: 'Apple A17' })).toBe('mobile');
    expect(graphicsTier({ coarse: false, renderer: 'Intel(R) UHD Graphics' })).toBe('mobile');
    expect(graphicsTier({ coarse: false, renderer: 'NVIDIA RTX 3060' })).toBe('gpu');
    expect(graphicsTier({ coarse: false, caveatFailed: true })).toBe('cpu');
  });
  it('budgets sky, resolution, vegetation and lighting progressively', () => {
    const cpu = graphicsProfile('cpu'), mobile = graphicsProfile('mobile'), gpu = graphicsProfile('gpu');
    expect(cpu.shadows).toBe(false); expect(mobile.shadows && gpu.shadows).toBe(true);
    for (const key of ['pixelRatio', 'skyDay', 'skyNight', 'plants', 'forest', 'lights'] as const) {
      expect(cpu[key]).toBeLessThan(mobile[key]); expect(mobile[key]).toBeLessThan(gpu[key]);
    }
    expect(cpu.reduced && mobile.reduced).toBe(true); expect(gpu.reduced).toBe(false);
  });
});
