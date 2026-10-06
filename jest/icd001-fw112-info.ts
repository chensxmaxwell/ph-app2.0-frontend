/**
 * Full `INFO` command reply of h11-icd-v1 1.1.2 (PROTOCOL-ICD001 §11.9 / §11.9.2),
 * byte-for-byte the firmware's buildInfoJson(full=true) snprintf format with the
 * shipped constants (icd_core.h / ppg_hr.h). 1.1.1 added `auto.hrValid`, 1.1.2 the
 * `hrValid.fast` block. With rst "BROWNOUT" it is the 874 B reply hardware quoted.
 */
export function fw112InfoJson(rst = 'BROWNOUT', extraTopLevel = ''): string {
  return (
    '{"proto":"ICD001-1","prod":"ICD-001","hw":"H1.1","fw":"1.1.2","mux":1,"adsA":1,"adsB":1,"imu":1,"ppg":[1,1,1],' +
    '"ch":{"lra":{"A":"上翼","B":"下翼"},"freq":{"min":100,"max":300,"def":170},"vhz":{"min":2,"max":50,"def":10},' +
    '"lpulse":{"min":50,"max":2000},"ppg":["J13","J22","J23"],"egg":{"ppg":-1,"act":0},' +
    '"ot":{"trip":42,"clear":39},"lb":{"trip":3.40,"clear":3.70,"holdS":60},"mode":["manual","auto"],"boot":"auto"' +
    ',"auto":{"vhz":{"min":5,"max":10},"press":{"on":80,"off":50,"full":1200},"hr":{"lo":60,"hi":120},"lraNoHr":0,' +
    '"hrValid":{"amp":0.0025,"bpm":[45,150],"nIv":4,"tol":0.20,"bp":[0.7,3.0],"lostMs":2000,' +
    '"fast":{"lra":40,"nIv":1,"ampRatio":[0.6,1.6],"corr":0.85,"holdMs":120,"bad":"2of3","tol":0.20,' +
    '"lostMs":2000,"confirmMs":8000,"blockMs":[3000,48000]}},' +
    `"fsr":["J19","J20"],"lraSrc":{"A":0,"B":2},"hbMaxS":30,"maxMin":0}},"name":"h11-icd-v1","rst":"${rst}","ntc":1${extraTopLevel}}`
  );
}

export const byteLen = (s: string) => new TextEncoder().encode(s).length;

/** The 874 B reply (fw 1.1.2). */
export const INFO_874 = fw112InfoJson();

/**
 * Padded with an unknown top-level key (future firmware) to exactly `bytes` B of
 * JSON. 1100 B is one byte over what the fw buffer can hold (1099 + NUL), so it
 * covers the worst case.
 */
export function paddedInfo(bytes: number): string {
  const base = byteLen(fw112InfoJson('BROWNOUT', ',"future":""'));
  return fw112InfoJson('BROWNOUT', `,"future":"${'x'.repeat(bytes - base)}"`);
}

export const INFO_1100 = paddedInfo(1100);

/** fw buildTlmJson shape, 1.1.2 FAST stage: contact, HR still 0, LRA at 40 (§11.9.2 item 2). */
export function fw112FastTlm(lra: [number, number] = [40, 0]): string {
  return (
    '{"t":123456,"mode":"auto","src":{"fsr":[1,1],"ppg":[1,1,1]},' +
    '"ppg":[[98000,1,0],[0,0,0],[91000,1,0]],"fsr":[0,0,0,0,0],"hall":0,"ntc":33.1,"vbat":3.95,' +
    `"acc":[0.01,0.02,0.98],"gyr":[0,0,0],"lra":[${lra[0]},${lra[1]}],"lset":[0,0],"lp":[[0,0],[0,0]],"f":170,"vhz":0,` +
    '"auto":1,"estop":0,"ot":0,"lb":0,"hb":30,"press":0,"pz":0}'
  );
}
