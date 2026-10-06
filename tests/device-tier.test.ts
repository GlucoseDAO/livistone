import { describe, expect, it } from 'vitest';
import { deviceNote, deviceTier, flagshipMobileRenderer, gpuLabel, graphicsTip, platform, TierAdvisor } from '../src/game/device-tier';

describe('flagship phone GPUs', () => {
  it('raises Adreno 730 and up, Immortalis and Xclipse 9xx', () => {
    for (const name of ['ANGLE (Qualcomm, Adreno (TM) 840, OpenGL ES 3.2)', 'Adreno (TM) 830', 'Adreno (TM) 750', 'Adreno (TM) 740', 'Adreno (TM) 732',
      'Adreno (TM) 730', 'Adreno (TM) 825', 'Mali-G925-Immortalis MC12', 'Immortalis-G720', 'Samsung Xclipse 940', 'ANGLE (Samsung, Xclipse 960, OpenGL ES 3.2)']) expect(flagshipMobileRenderer(name), name).toBe(true);
  });
  it('keeps mid-range and unnamed phone GPUs Balanced', () => {
    for (const name of ['Adreno (TM) 720', 'Adreno (TM) 710', 'Adreno (TM) 660', 'Adreno (TM) 810', 'Mali-G715', 'Mali-G68 MC4', 'Apple GPU', 'Samsung Xclipse 530', '',
      'qualcomm adreno-8xx']) expect(flagshipMobileRenderer(name), name).toBe(false);
  });
  it('changes only a phone the probe put on Balanced, and reads the name only then', () => {
    const adreno = () => 'ANGLE (Qualcomm, Adreno (TM) 840, OpenGL ES 3.2)';
    expect(deviceTier({ tier: 'mobile', coarse: true }, adreno)).toBe('gpu');
    expect(deviceTier({ tier: 'mobile', coarse: true }, () => 'Adreno (TM) 710')).toBe('mobile');
    // A laptop iGPU stays Balanced; software and older Intel stay Lightweight; a touch screen on SwiftShader is never raised.
    const unread = () => { throw new Error('name read'); };
    expect(deviceTier({ tier: 'mobile', coarse: false }, unread)).toBe('mobile');
    expect(deviceTier({ tier: 'cpu', coarse: true }, unread)).toBe('cpu');
    expect(deviceTier({ tier: 'gpu', coarse: false }, unread)).toBe('gpu');
  });
});

describe('graphics menu device note', () => {
  it('names the GPU without ANGLE wrapping or PCI ids', () => {
    expect(gpuLabel('ANGLE (Qualcomm, Adreno (TM) 840, OpenGL ES 3.2)')).toBe('Adreno (TM) 840');
    expect(gpuLabel('ANGLE (Intel, Mesa Intel(R) Graphics (RPL-S), OpenGL 4.6)')).toBe('Mesa Intel(R) Graphics (RPL-S)');
    expect(gpuLabel('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 (0x00002484) Direct3D11 vs_5_0 ps_5_0, D3D11)')).toBe('NVIDIA GeForce RTX 3060');
    expect(gpuLabel('Apple GPU')).toBe('Apple GPU');
    expect(gpuLabel('', { vendor: 'nvidia', architecture: 'lovelace' })).toBe('nvidia lovelace');
    expect(gpuLabel('ANGLE (NVIDIA, Vulkan 1.4.329 (NVIDIA NVIDIA GeForce RTX 4090 Laptop GPU (0x00002717)), NVIDIA)', { vendor: 'nvidia', architecture: 'lovelace' })).toBe('NVIDIA GeForce RTX 4090 Laptop GPU');
    expect(gpuLabel('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)')).toBe('SwiftShader Device (Subzero)');
    // Hybrid laptop: WebGPU on the NVIDIA card while WebGL stayed on the Intel one.
    expect(gpuLabel('ANGLE (Intel, Mesa Intel(R) Graphics (RPL-S), OpenGL 4.6)', { vendor: 'nvidia', architecture: 'lovelace' })).toBe('nvidia lovelace');
    expect(gpuLabel('ANGLE (Intel, Mesa Intel(R) Graphics (RPL-S), OpenGL 4.6)', { vendor: 'intel', architecture: 'gen-12lp' })).toBe('Mesa Intel(R) Graphics (RPL-S)');
  });
  it('points software rendering at hardware acceleration and a desktop iGPU at the stronger card', () => {
    expect(deviceNote({ tier: 'cpu', coarse: false, software: true }, 'webgl2-fallback', 'SwiftShader Device')).toMatch(/without the graphics card.*hardware acceleration/);
    expect(deviceNote({ tier: 'mobile', coarse: false, software: false }, 'webgl2-fallback', 'Mesa Intel(R) Graphics (RPL-S)')).toMatch(/^This device: Mesa Intel\(R\) Graphics \(RPL-S\) · WebGL 2\. This is integrated graphics/);
    expect(deviceNote({ tier: 'mobile', coarse: true, software: false }, 'webgpu', 'Adreno (TM) 710')).toBe('This device: Adreno (TM) 710 · WebGPU.');
    expect(deviceNote({ tier: 'gpu', coarse: false, software: false }, 'webgpu', '')).toBe('This device: graphics unnamed by the browser · WebGPU.');
  });
});

describe('browser-setting tips', () => {
  const linux = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36';
  it('recognises desktop Chrome on Linux, not Android, ChromeOS or Firefox', () => {
    expect(platform(linux).linuxChrome).toBe(true);
    expect(platform('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Mobile Safari/537.36').linuxChrome).toBe(false);
    expect(platform('Mozilla/5.0 (X11; CrOS x86_64 16000.0.0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36').linuxChrome).toBe(false);
    expect(platform('Mozilla/5.0 (X11; Linux x86_64; rv:150.0) Gecko/20100101 Firefox/150.0').linuxChrome).toBe(false);
    expect(platform('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36').linuxChrome).toBe(false);
  });
  it('speaks only where a setting holds the town back', () => {
    const on = { linuxChrome: true }, off = { linuxChrome: false };
    expect(graphicsTip({ tier: 'cpu', coarse: false, software: true }, 'webgl2-fallback', off)).toMatch(/hardware acceleration/);
    // The laptop of 6 Oct 2026: Chrome on Linux without WebGPU drew Balanced on its Intel GPU beside an RTX 4090.
    expect(graphicsTip({ tier: 'mobile', coarse: false, software: false }, 'webgl2-fallback', on)).toMatch(/chrome:\/\/flags.*Vulkan, Vulkan from ANGLE, Default ANGLE Vulkan and Unsafe WebGPU Support/);
    expect(graphicsTip({ tier: 'mobile', coarse: false, software: false }, 'webgpu', on)).toBe('');
    expect(graphicsTip({ tier: 'gpu', coarse: false, software: false }, 'webgl2-fallback', on)).toBe('');
    expect(graphicsTip({ tier: 'mobile', coarse: false, software: false }, 'webgl2-fallback', off)).toBe('');
    expect(deviceNote({ tier: 'mobile', coarse: false, software: false }, 'webgl2-fallback', 'Mesa Intel(R) Graphics (RPL-S)', on)).toMatch(/^This device: Mesa Intel\(R\) Graphics \(RPL-S\) · WebGL 2\. On Linux, Chrome/);
  });
});

describe('frame-rate offers', () => {
  const walk = (advisor: TierAdvisor, seconds: number, fps: number, scale: number, floor: number, ceiling: number) => {
    let offer = null; for (let i = 0; i < seconds && !offer; i++) offer = advisor.sample(fps, 1, scale, floor, ceiling); return offer;
  };
  it('offers Rich after fifteen smooth seconds on Balanced at its ceiling, once', () => {
    const advisor = new TierAdvisor('mobile', false, 28);
    expect(walk(advisor, 14, 60, 1, .75, 1)).toBeNull();
    expect(advisor.sample(60, 1, 1, .75, 1)).toBe('rich');
    expect(walk(advisor, 30, 60, 1, .75, 1)).toBeNull();
  });
  it('needs the seconds in a row, at the ceiling', () => {
    const advisor = new TierAdvisor('mobile', false, 28);
    expect(walk(advisor, 10, 60, 1, .75, 1)).toBeNull(); advisor.sample(40, 1, 1, .75, 1);
    expect(walk(advisor, 14, 60, 1, .75, 1)).toBeNull();
    expect(walk(new TierAdvisor('mobile', false, 28), 60, 60, .9, .75, 1)).toBeNull();
  });
  it('offers the next level down when a tier stays under half its target at its floor', () => {
    expect(walk(new TierAdvisor('gpu', false, 50), 15, 20, 1, 1, 1.5)).toBe('balanced');
    expect(walk(new TierAdvisor('gpu', false, 50), 60, 30, 1, 1, 1.5)).toBeNull();
    expect(walk(new TierAdvisor('mobile', false, 28), 15, 12, .75, .75, 1)).toBe('light');
  });
  it('offers Balanced from Lightweight on a real GPU, nothing from software rendering, nothing declined', () => {
    expect(walk(new TierAdvisor('cpu', false, 28), 15, 60, .75, .4, .75)).toBe('balanced');
    expect(walk(new TierAdvisor('cpu', true, 18), 60, 60, .55, .3, .55)).toBeNull();
    expect(walk(new TierAdvisor('cpu', true, 18), 60, 5, .3, .3, .55)).toBeNull();
    expect(walk(new TierAdvisor('mobile', false, 28, ['mobile:rich']), 60, 60, 1, .75, 1)).toBeNull();
  });
});
